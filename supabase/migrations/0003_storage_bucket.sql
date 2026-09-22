-- 0003_storage_bucket.sql
-- Bucket PRIVADO para fotos del equipo, firmas (PNG) y, si aplica, PDFs del acta.
-- Aislamiento por empresa vía el PRIMER segmento del path: {empresa_id}/{entrega_id}/{uuid}
-- (Manual 6): la policy valida sin JOIN comparando esa carpeta con get_empresa_id_actual().
-- El acceso de lectura real se resuelve con createSignedUrl de corta duración (nunca público).

-- Bucket privado (public=false) con límite de tamaño y MIME permitidos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'entregas-privado', 'entregas-privado', false,
  10485760,  -- 10 MB
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Policies sobre storage.objects, acotadas a este bucket y a la empresa del usuario.
-- foldername(name)[1] = primer segmento del path = empresa_id.

drop policy if exists entregas_priv_select on storage.objects;
create policy entregas_priv_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'entregas-privado'
    and (storage.foldername(name))[1] = public.get_empresa_id_actual()::text
  );

drop policy if exists entregas_priv_insert on storage.objects;
create policy entregas_priv_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'entregas-privado'
    and (storage.foldername(name))[1] = public.get_empresa_id_actual()::text
  );

drop policy if exists entregas_priv_update on storage.objects;
create policy entregas_priv_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'entregas-privado'
    and (storage.foldername(name))[1] = public.get_empresa_id_actual()::text
  )
  with check (
    bucket_id = 'entregas-privado'
    and (storage.foldername(name))[1] = public.get_empresa_id_actual()::text
  );

drop policy if exists entregas_priv_delete on storage.objects;
create policy entregas_priv_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'entregas-privado'
    and (storage.foldername(name))[1] = public.get_empresa_id_actual()::text
  );
