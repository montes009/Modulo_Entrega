-- Acceso solo para el/los coordinadores autorizados (antes: cualquier usuario autenticado).
-- Sin SECURITY DEFINER: la política consulta upbq_coordinadores, cuya propia RLS deja a cada
-- usuario ver únicamente su fila. No hay políticas de escritura en esa tabla: solo se modifica
-- con migraciones / SQL editor (service role), nunca desde el cliente.
-- Para cambiar de coordinador: insert / delete en upbq_coordinadores desde una migración.

create table public.upbq_coordinadores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nota text,
  created_at timestamptz not null default now()
);
alter table public.upbq_coordinadores enable row level security;
create policy upbq_coordinadores_self on public.upbq_coordinadores
  for select to authenticated using (user_id = (select auth.uid()));

-- Coordinador actual (cuenta creada el 2026-09-29).
insert into public.upbq_coordinadores (user_id, nota)
values ('8ba1b10e-8c9c-49e6-b1a9-dce27d1726b9', 'Coordinador de sede');

-- Red de seguridad: si no hay ningún coordinador válido, abortar TODO (evita quedar bloqueado).
do $$
begin
  if not exists (select 1 from public.upbq_coordinadores c join auth.users u on u.id = c.user_id) then
    raise exception 'No hay coordinador válido: migración abortada';
  end if;
end $$;

-- Reemplazar la política "cualquier autenticado" por "solo coordinadores" en todas las tablas.
do $$
declare t text;
begin
  foreach t in array array['upbq_clientes','upbq_cotizaciones','upbq_maquinas','upbq_alquileres',
    'upbq_alquiler_novedades','upbq_recordatorios','upbq_pendientes','upbq_festivos',
    'upbq_negociaciones','upbq_negociacion_mensajes'] loop
    execute format('drop policy if exists %I on public.%I', t || '_auth', t);
    execute format($p$create policy %I on public.%I for all to authenticated
      using (exists (select 1 from public.upbq_coordinadores c where c.user_id = (select auth.uid())))
      with check (exists (select 1 from public.upbq_coordinadores c where c.user_id = (select auth.uid())))$p$,
      t || '_coord', t);
  end loop;
end $$;

-- Storage del bucket de negociaciones.
drop policy if exists upbq_neg_storage_auth on storage.objects;
create policy upbq_neg_storage_coord on storage.objects for all to authenticated
  using (bucket_id = 'upbq-negociaciones'
         and exists (select 1 from public.upbq_coordinadores c where c.user_id = (select auth.uid())))
  with check (bucket_id = 'upbq-negociaciones'
         and exists (select 1 from public.upbq_coordinadores c where c.user_id = (select auth.uid())));
