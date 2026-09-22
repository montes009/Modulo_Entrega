-- 0004_crear_solo_supervisor_admin.sql
-- Autorización por rol: crear una entrega queda restringido a admin/supervisor.
-- El operador ya NO puede iniciar actas (sí puede llenar checklist, subir fotos, cerrar
-- y firmar; anular sigue siendo admin/supervisor). La seguridad manda en el servidor:
-- ocultar el botón en el frontend es solo comodidad visual.
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
  v_rol     text := public.get_rol_actual();
  v_id uuid;
begin
  if v_empresa is null then
    raise exception 'usuario sin empresa asignada';
  end if;
  if v_rol not in ('admin','supervisor') then
    raise exception 'rol % no autorizado para crear entregas', coalesce(v_rol, '(ninguno)');
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
