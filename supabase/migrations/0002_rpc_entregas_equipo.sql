-- 0002_rpc_entregas_equipo.sql
-- RPCs SECURITY DEFINER: ÚNICA vía de escritura sensible del módulo de Entrega de Equipos.
-- Cada RPC valida en el servidor (Manual sec. 3): empresa dueña (get_empresa_id_actual,
-- nunca un empresa_id del cliente), rol autorizado, estado válido para la transición y
-- campos obligatorios. La escritura directa está bloqueada por RLS (RLS activada + sin
-- policy de INSERT/UPDATE/DELETE => todo write directo denegado).
--
-- GRANT/REVOKE correcto (Manual 3.3): revoke de PUBLIC no alcanza en Supabase (concede
-- EXECUTE a anon/authenticated por default privileges) -> revocar de anon explícito y
-- verificar con has_function_privilege.

-- ============================================================
-- Helper: rol del usuario autenticado en su empresa (para autorización server-side).
-- ============================================================
create or replace function public.get_rol_actual()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select ue.rol
  from public.usuarios_empresas ue
  where ue.user_id = auth.uid() and ue.activo
  limit 1;
$$;

-- ============================================================
-- crear_entrega_equipo -> uuid (arranca en 'borrador')
-- ============================================================
create or replace function public.crear_entrega_equipo(
  p_equipo_id      text,
  p_cliente_nombre text,
  p_recibido_por   text,
  p_cliente_cedula text default null,
  p_observaciones  text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_id uuid;
begin
  if v_empresa is null then
    raise exception 'usuario sin empresa asignada';
  end if;
  if coalesce(p_equipo_id,'') = '' or coalesce(p_cliente_nombre,'') = ''
     or coalesce(p_recibido_por,'') = '' then
    raise exception 'faltan campos obligatorios (equipo, cliente, recibido_por)';
  end if;

  insert into public.entregas_equipo(
    empresa_id, equipo_id, cliente_nombre, cliente_cedula,
    entregado_por, recibido_por, estado, observaciones)
  values (v_empresa, p_equipo_id, p_cliente_nombre, p_cliente_cedula,
          auth.uid(), p_recibido_por, 'borrador', p_observaciones)
  returning id into v_id;

  insert into public.entregas_equipo_historial(
    empresa_id, entrega_id, estado_antes, estado_despues, actor)
  values (v_empresa, v_id, null, 'borrador', auth.uid());

  return v_id;
end $$;

-- ============================================================
-- guardar_checklist_item -> uuid (crea si p_item_id es null; si no, actualiza respuesta)
-- Solo editable mientras la entrega está en 'borrador' (guardado incremental).
-- ============================================================
create or replace function public.guardar_checklist_item(
  p_entrega_id      uuid,
  p_item_id         uuid,
  p_titulo          text,
  p_respuesta       text default null,
  p_observacion     text default null,
  p_obligatorio     boolean default true,
  p_foto_obligatoria boolean default false
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_estado  text;
  v_id      uuid;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;

  select estado into v_estado
  from public.entregas_equipo
  where id = p_entrega_id and empresa_id = v_empresa
  for update;
  if v_estado is null then raise exception 'entrega no encontrada'; end if;
  if v_estado <> 'borrador' then
    raise exception 'checklist no editable en estado %', v_estado;
  end if;
  if p_respuesta is not null and p_respuesta not in ('ok','observacion','no_aplica') then
    raise exception 'respuesta inválida: %', p_respuesta;
  end if;

  if p_item_id is null then
    insert into public.entregas_equipo_checklist_items(
      empresa_id, entrega_id, titulo, respuesta, observacion, obligatorio, foto_obligatoria)
    values (v_empresa, p_entrega_id, p_titulo, p_respuesta, p_observacion,
            coalesce(p_obligatorio, true), coalesce(p_foto_obligatoria, false))
    returning id into v_id;
  else
    update public.entregas_equipo_checklist_items
      set respuesta = p_respuesta,
          observacion = p_observacion,
          titulo = coalesce(p_titulo, titulo)
      where id = p_item_id and entrega_id = p_entrega_id and empresa_id = v_empresa
      returning id into v_id;
    if v_id is null then raise exception 'ítem de checklist no encontrado'; end if;
  end if;

  return v_id;
end $$;

-- ============================================================
-- registrar_foto -> uuid (metadata; el binario ya subió al bucket privado del cliente)
-- Permitida en 'borrador' y 'en_proceso'.
-- ============================================================
create or replace function public.registrar_foto(
  p_entrega_id  uuid,
  p_storage_path text,
  p_item_id     uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_estado  text;
  v_id      uuid;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if coalesce(p_storage_path,'') = '' then raise exception 'storage_path vacío'; end if;

  select estado into v_estado
  from public.entregas_equipo
  where id = p_entrega_id and empresa_id = v_empresa
  for update;
  if v_estado is null then raise exception 'entrega no encontrada'; end if;
  if v_estado not in ('borrador','en_proceso') then
    raise exception 'no se pueden agregar fotos en estado %', v_estado;
  end if;

  insert into public.entregas_equipo_fotos(
    empresa_id, entrega_id, item_id, storage_path, subida_por)
  values (v_empresa, p_entrega_id, p_item_id, p_storage_path, auth.uid())
  returning id into v_id;

  return v_id;
end $$;

-- ============================================================
-- cerrar_checklist (borrador -> en_proceso)
-- Valida que todos los ítems obligatorios estén respondidos y con foto si la exigen.
-- ============================================================
create or replace function public.cerrar_checklist(p_entrega_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_estado  text;
  v_faltan  int;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;

  select estado into v_estado
  from public.entregas_equipo
  where id = p_entrega_id and empresa_id = v_empresa
  for update;
  if v_estado is null then raise exception 'entrega no encontrada'; end if;
  if v_estado <> 'borrador' then
    raise exception 'solo se cierra un checklist en borrador (estado actual %)', v_estado;
  end if;

  if not exists (select 1 from public.entregas_equipo_checklist_items
                 where entrega_id = p_entrega_id) then
    raise exception 'checklist vacío';
  end if;

  select count(*) into v_faltan
  from public.entregas_equipo_checklist_items i
  where i.entrega_id = p_entrega_id
    and i.obligatorio
    and (i.respuesta is null
         or (i.foto_obligatoria and not exists (
              select 1 from public.entregas_equipo_fotos f where f.item_id = i.id)));
  if v_faltan > 0 then
    raise exception 'checklist incompleto: % ítem(s) obligatorio(s) pendiente(s)', v_faltan;
  end if;

  update public.entregas_equipo
    set estado = 'en_proceso', updated_at = now()
    where id = p_entrega_id;

  insert into public.entregas_equipo_historial(
    empresa_id, entrega_id, estado_antes, estado_despues, actor)
  values (v_empresa, p_entrega_id, 'borrador', 'en_proceso', auth.uid());
end $$;

-- ============================================================
-- registrar_firma -> text (nuevo estado). Única vía de escritura de _firmas.
-- Al registrar la 2ª firma, pasa el acta a 'firmada' en la MISMA transacción.
-- El unique(entrega_id, rol) impide dos firmas del mismo rol.
-- ============================================================
create or replace function public.registrar_firma(
  p_entrega_id  uuid,
  p_rol         text,
  p_nombre      text,
  p_storage_path text,
  p_acta_hash   text,
  p_documento   text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_estado  text;
  v_firmas  int;
  v_nuevo   text;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if p_rol not in ('entrega','recibe') then raise exception 'rol de firma inválido: %', p_rol; end if;
  if coalesce(p_nombre,'') = '' or coalesce(p_storage_path,'') = ''
     or coalesce(p_acta_hash,'') = '' then
    raise exception 'firma incompleta (nombre, imagen y hash son obligatorios)';
  end if;

  select estado into v_estado
  from public.entregas_equipo
  where id = p_entrega_id and empresa_id = v_empresa
  for update;
  if v_estado is null then raise exception 'entrega no encontrada'; end if;
  if v_estado <> 'en_proceso' then
    raise exception 'solo se firma una entrega en_proceso (estado actual %)', v_estado;
  end if;

  insert into public.entregas_equipo_firmas(
    empresa_id, entrega_id, rol, nombre, documento, storage_path, acta_hash)
  values (v_empresa, p_entrega_id, p_rol, p_nombre, p_documento, p_storage_path, p_acta_hash);

  select count(*) into v_firmas
  from public.entregas_equipo_firmas
  where entrega_id = p_entrega_id;

  if v_firmas >= 2 then
    update public.entregas_equipo
      set estado = 'firmada', updated_at = now()
      where id = p_entrega_id;
    insert into public.entregas_equipo_historial(
      empresa_id, entrega_id, estado_antes, estado_despues, actor)
    values (v_empresa, p_entrega_id, 'en_proceso', 'firmada', auth.uid());
    v_nuevo := 'firmada';
  else
    v_nuevo := 'en_proceso';
  end if;

  return v_nuevo;
end $$;

-- ============================================================
-- anular_entrega (-> anulada). Motivo obligatorio, solo admin/supervisor.
-- Nunca se borra el registro: se anula y se rehace (Manual 5.3).
-- ============================================================
create or replace function public.anular_entrega(
  p_entrega_id uuid,
  p_motivo     text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid := public.get_empresa_id_actual();
  v_rol     text := public.get_rol_actual();
  v_estado  text;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if v_rol not in ('admin','supervisor') then
    raise exception 'rol % no autorizado para anular', coalesce(v_rol, '(ninguno)');
  end if;
  if coalesce(p_motivo,'') = '' then raise exception 'motivo de anulación obligatorio'; end if;

  select estado into v_estado
  from public.entregas_equipo
  where id = p_entrega_id and empresa_id = v_empresa
  for update;
  if v_estado is null then raise exception 'entrega no encontrada'; end if;
  if v_estado = 'anulada' then raise exception 'la entrega ya está anulada'; end if;

  update public.entregas_equipo
    set estado = 'anulada', updated_at = now()
    where id = p_entrega_id;

  insert into public.entregas_equipo_historial(
    empresa_id, entrega_id, estado_antes, estado_despues, motivo, actor)
  values (v_empresa, p_entrega_id, v_estado, 'anulada', p_motivo, auth.uid());
end $$;

-- ============================================================
-- GRANT/REVOKE por cada RPC (Manual 3.3): PUBLIC + anon fuera, authenticated dentro.
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'public.get_rol_actual()',
    'public.crear_entrega_equipo(text,text,text,text,text)',
    'public.guardar_checklist_item(uuid,uuid,text,text,text,boolean,boolean)',
    'public.registrar_foto(uuid,text,uuid)',
    'public.cerrar_checklist(uuid)',
    'public.registrar_firma(uuid,text,text,text,text,text)',
    'public.anular_entrega(uuid,text)'
  ] loop
    execute 'revoke execute on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'grant  execute on function ' || f || ' to authenticated';
  end loop;
end $$;
