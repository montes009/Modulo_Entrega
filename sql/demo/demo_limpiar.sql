-- Borra TODOS los datos DEMO creados por demo_seed.sql (y solo esos). Respeta el orden de las FK.
-- Si algún día se suben adjuntos a un hilo DEMO, borrar también sus archivos del bucket upbq-negociaciones.
do $$
declare ids_cli uuid[]; ids_maq uuid[];
begin
  select coalesce(array_agg(id), '{}') into ids_cli from public.upbq_clientes where nombre like 'DEMO · %';
  select coalesce(array_agg(id), '{}') into ids_maq from public.upbq_maquinas where codigo like 'DEMO-%';

  delete from public.upbq_negociaciones where cliente_id = any(ids_cli);            -- mensajes en cascada
  delete from public.upbq_alquileres where cliente_id = any(ids_cli) or maquina_id = any(ids_maq); -- novedades en cascada
  delete from public.upbq_recordatorios where cliente_id = any(ids_cli) or texto like '[DEMO]%';
  delete from public.upbq_cotizaciones where cliente_id = any(ids_cli);
  delete from public.upbq_pendientes where texto like '[DEMO]%';
  delete from public.upbq_maquinas where id = any(ids_maq);
  delete from public.upbq_clientes where id = any(ids_cli);
end $$;
