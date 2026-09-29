-- Limpieza del antiguo Módulo de Entrega (ya aplicada en Supabase).
-- Se conserva rls_auto_enable() (event trigger de plantilla Supabase) y el bucket entregas-privado.
drop policy if exists entregas_priv_select on storage.objects;
drop policy if exists entregas_priv_insert on storage.objects;
drop policy if exists entregas_priv_update on storage.objects;
drop policy if exists entregas_priv_delete on storage.objects;
drop function if exists public.anular_entrega(uuid,text);
drop function if exists public.cerrar_checklist(uuid);
drop function if exists public.crear_entrega_equipo(text,text,text,text,text,text);
drop function if exists public.eliminar_plantilla_item(uuid);
drop function if exists public.get_empresa_id_actual();
drop function if exists public.get_rol_actual();
drop function if exists public.guardar_checklist_item(uuid,uuid,text,text,text,boolean,boolean);
drop function if exists public.guardar_plantilla_item(uuid,uuid,text,boolean,boolean,integer);
drop function if exists public.guardar_plantilla(uuid,text,text,boolean);
drop function if exists public.registrar_firma(uuid,text,text,text,text,text);
drop function if exists public.registrar_foto(uuid,text,uuid);
