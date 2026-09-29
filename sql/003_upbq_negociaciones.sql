-- Bitácora de Negociaciones: un hilo por cliente + mensajes (texto / imagen / pdf).
-- Adjuntos en Storage privado; en BD solo storage_path (nunca URL absoluta).

create table public.upbq_negociaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null unique references public.upbq_clientes(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.upbq_negociacion_mensajes (
  id uuid primary key default gen_random_uuid(),
  negociacion_id uuid not null references public.upbq_negociaciones(id) on delete cascade,
  cotizacion_id uuid references public.upbq_cotizaciones(id) on delete set null,
  fecha timestamptz not null,
  emisor text not null check (emisor in ('cliente','nosotros')),
  tipo text not null default 'texto' check (tipo in ('texto','imagen','pdf')),
  contenido text,
  storage_path text,
  nombre_archivo text,
  origen text not null default 'manual' check (origen in ('manual','whatsapp','json')),
  hash text not null,               -- evita duplicados al reimportar el mismo export
  created_at timestamptz not null default now(),
  constraint upbq_msg_contenido check (
    (tipo = 'texto' and coalesce(btrim(contenido), '') <> '')
    or (tipo in ('imagen','pdf') and storage_path is not null)
  )
);
create unique index upbq_msg_hash_uq on public.upbq_negociacion_mensajes (negociacion_id, hash);
create index on public.upbq_negociacion_mensajes (negociacion_id, fecha);
create index on public.upbq_negociacion_mensajes (cotizacion_id);

alter table public.upbq_negociaciones enable row level security;
alter table public.upbq_negociacion_mensajes enable row level security;
create policy upbq_negociaciones_auth on public.upbq_negociaciones for all to authenticated using (true) with check (true);
create policy upbq_negociacion_mensajes_auth on public.upbq_negociacion_mensajes for all to authenticated using (true) with check (true);

-- Bucket PRIVADO (10 MB, solo imágenes y PDF).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('upbq-negociaciones', 'upbq-negociaciones', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/gif','application/pdf'])
on conflict (id) do nothing;

create policy upbq_neg_storage_auth on storage.objects for all to authenticated
  using (bucket_id = 'upbq-negociaciones') with check (bucket_id = 'upbq-negociaciones');
