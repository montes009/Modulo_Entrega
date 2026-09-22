-- 0005_plantillas_checklist.sql
-- Plantillas de checklist por tipo de equipo. Al crear una entrega de un tipo, el
-- checklist se precarga copiando los ítems de la plantilla ACTIVA de ese tipo.
-- Gestión de plantillas: admin/supervisor (config). Escritura solo por RPC.

-- Ítems de cada plantilla (la cabecera vive en entregas_equipo_checklist_templates).
create table if not exists public.entregas_equipo_checklist_template_items (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null,
  template_id      uuid not null references public.entregas_equipo_checklist_templates(id) on delete cascade,
  titulo           text not null,
  obligatorio      boolean not null default true,
  foto_obligatoria boolean not null default false,
  orden            int not null default 0,
  created_at       timestamptz not null default now()
);
alter table public.entregas_equipo_checklist_template_items enable row level security;

create policy entregas_equipo_checklist_template_items_sel
  on public.entregas_equipo_checklist_template_items
  for select to authenticated
  using (empresa_id = public.get_empresa_id_actual());

-- Guardar (crear/renombrar) una plantilla-cabecera. admin/supervisor.
create or replace function public.guardar_plantilla(
  p_template_id uuid, p_tipo_equipo text, p_nombre text, p_activo boolean default true
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := public.get_empresa_id_actual(); v_rol text := public.get_rol_actual(); v_id uuid;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if v_rol not in ('admin','supervisor') then raise exception 'rol % no autorizado para gestionar plantillas', coalesce(v_rol,'(ninguno)'); end if;
  if coalesce(p_tipo_equipo,'')='' or coalesce(p_nombre,'')='' then raise exception 'tipo_equipo y nombre son obligatorios'; end if;
  if p_template_id is null then
    insert into public.entregas_equipo_checklist_templates(empresa_id, tipo_equipo, nombre, activo)
    values (v_empresa, p_tipo_equipo, p_nombre, coalesce(p_activo,true)) returning id into v_id;
  else
    update public.entregas_equipo_checklist_templates
      set tipo_equipo=p_tipo_equipo, nombre=p_nombre, activo=coalesce(p_activo,true)
      where id=p_template_id and empresa_id=v_empresa returning id into v_id;
    if v_id is null then raise exception 'plantilla no encontrada'; end if;
  end if;
  return v_id;
end $$;

-- Guardar (crear/editar) un ítem de plantilla. admin/supervisor.
create or replace function public.guardar_plantilla_item(
  p_template_id uuid, p_item_id uuid, p_titulo text,
  p_obligatorio boolean default true, p_foto_obligatoria boolean default false, p_orden int default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := public.get_empresa_id_actual(); v_rol text := public.get_rol_actual(); v_id uuid; v_owner uuid;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if v_rol not in ('admin','supervisor') then raise exception 'rol % no autorizado', coalesce(v_rol,'(ninguno)'); end if;
  if coalesce(p_titulo,'')='' then raise exception 'título obligatorio'; end if;
  -- la plantilla debe ser de la misma empresa
  select empresa_id into v_owner from public.entregas_equipo_checklist_templates where id=p_template_id;
  if v_owner is null or v_owner <> v_empresa then raise exception 'plantilla no encontrada'; end if;
  if p_item_id is null then
    insert into public.entregas_equipo_checklist_template_items(empresa_id, template_id, titulo, obligatorio, foto_obligatoria, orden)
    values (v_empresa, p_template_id, p_titulo, coalesce(p_obligatorio,true), coalesce(p_foto_obligatoria,false), coalesce(p_orden,0))
    returning id into v_id;
  else
    update public.entregas_equipo_checklist_template_items
      set titulo=p_titulo, obligatorio=coalesce(p_obligatorio,true), foto_obligatoria=coalesce(p_foto_obligatoria,false), orden=coalesce(p_orden,0)
      where id=p_item_id and template_id=p_template_id and empresa_id=v_empresa returning id into v_id;
    if v_id is null then raise exception 'ítem de plantilla no encontrado'; end if;
  end if;
  return v_id;
end $$;

-- Eliminar un ítem de plantilla. admin/supervisor.
create or replace function public.eliminar_plantilla_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := public.get_empresa_id_actual(); v_rol text := public.get_rol_actual();
begin
  if v_rol not in ('admin','supervisor') then raise exception 'rol no autorizado'; end if;
  delete from public.entregas_equipo_checklist_template_items
    where id=p_item_id and empresa_id=v_empresa;
end $$;

-- entregas_equipo: guardar el tipo de equipo del acta.
alter table public.entregas_equipo add column if not exists tipo_equipo text;

-- crear_entrega_equipo con p_tipo_equipo: copia el checklist de la plantilla activa.
-- (drop + create porque cambia la firma; se re-otorgan permisos abajo.)
drop function if exists public.crear_entrega_equipo(text,text,text,text,text);
create or replace function public.crear_entrega_equipo(
  p_equipo_id text, p_cliente_nombre text, p_recibido_por text,
  p_cliente_cedula text default null, p_observaciones text default null, p_tipo_equipo text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_empresa uuid := public.get_empresa_id_actual(); v_rol text := public.get_rol_actual(); v_id uuid; v_tpl uuid;
begin
  if v_empresa is null then raise exception 'usuario sin empresa asignada'; end if;
  if v_rol not in ('admin','supervisor') then raise exception 'rol % no autorizado para crear entregas', coalesce(v_rol,'(ninguno)'); end if;
  if coalesce(p_equipo_id,'')='' or coalesce(p_cliente_nombre,'')='' or coalesce(p_recibido_por,'')='' then
    raise exception 'faltan campos obligatorios (equipo, cliente, recibido_por)'; end if;

  insert into public.entregas_equipo(empresa_id, equipo_id, cliente_nombre, cliente_cedula, entregado_por, recibido_por, estado, observaciones, tipo_equipo)
  values (v_empresa, p_equipo_id, p_cliente_nombre, p_cliente_cedula, auth.uid(), p_recibido_por, 'borrador', p_observaciones, p_tipo_equipo)
  returning id into v_id;

  -- Precargar checklist desde la plantilla activa del tipo (si existe).
  if coalesce(p_tipo_equipo,'') <> '' then
    select id into v_tpl from public.entregas_equipo_checklist_templates
      where empresa_id=v_empresa and tipo_equipo=p_tipo_equipo and activo
      order by created_at desc limit 1;
    if v_tpl is not null then
      insert into public.entregas_equipo_checklist_items(empresa_id, entrega_id, template_item_id, titulo, obligatorio, foto_obligatoria)
      select v_empresa, v_id, ti.id, ti.titulo, ti.obligatorio, ti.foto_obligatoria
      from public.entregas_equipo_checklist_template_items ti
      where ti.template_id = v_tpl order by ti.orden, ti.created_at;
    end if;
  end if;

  insert into public.entregas_equipo_historial(empresa_id, entrega_id, estado_antes, estado_despues, actor)
  values (v_empresa, v_id, null, 'borrador', auth.uid());
  return v_id;
end $$;

-- GRANT/REVOKE correcto por función (Manual 3.3).
do $$
declare f text;
begin
  foreach f in array array[
    'public.crear_entrega_equipo(text,text,text,text,text,text)',
    'public.guardar_plantilla(uuid,text,text,boolean)',
    'public.guardar_plantilla_item(uuid,uuid,text,boolean,boolean,int)',
    'public.eliminar_plantilla_item(uuid)'
  ] loop
    execute 'revoke execute on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'grant  execute on function ' || f || ' to authenticated';
  end loop;
end $$;
