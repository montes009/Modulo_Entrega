-- UP Barranquilla · base: clientes, cotizaciones, máquinas, alquileres, novedades,
-- recordatorios, pendientes. Un solo tenant; RLS simple (solo authenticated).
-- Los CHECK espejan las constantes de js/constantes.js (fuente única de estados).

create table public.upbq_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  email text,
  notas text,
  estado text not null default 'prospecto'
    check (estado in ('activo','en_mora','bloqueado','prospecto','inactivo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.upbq_cotizaciones (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.upbq_clientes(id) on delete restrict,
  equipo text,
  valor numeric(14,2),
  fecha date not null,
  estado text not null default 'borrador'
    check (estado in ('borrador','enviada','en_seguimiento','cerrada_ganada','cerrada_perdida')),
  proforma_solicitada boolean not null default false,
  proforma_fecha date,
  motivo_cierre text,
  fecha_cierre date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upbq_cot_motivo_cierre check (
    estado not in ('cerrada_ganada','cerrada_perdida') or coalesce(btrim(motivo_cierre),'') <> ''
  )
);
create index on public.upbq_cotizaciones (cliente_id);
create index on public.upbq_cotizaciones (estado);

create table public.upbq_maquinas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text,
  descripcion text,
  estado text not null default 'disponible' check (estado in ('disponible','alquilada')),
  created_at timestamptz not null default now()
);

create table public.upbq_alquileres (
  id uuid primary key default gen_random_uuid(),
  maquina_id uuid not null references public.upbq_maquinas(id) on delete restrict,
  cliente_id uuid not null references public.upbq_clientes(id) on delete restrict,
  cotizacion_id uuid references public.upbq_cotizaciones(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin date not null,
  estado text not null default 'activo' check (estado in ('activo','finalizado')),
  notas text,
  created_at timestamptz not null default now(),
  constraint upbq_alq_fechas check (fecha_fin >= fecha_inicio)
);
create index on public.upbq_alquileres (maquina_id, fecha_inicio);
create index on public.upbq_alquileres (cliente_id);

create table public.upbq_alquiler_novedades (
  id uuid primary key default gen_random_uuid(),
  alquiler_id uuid not null references public.upbq_alquileres(id) on delete cascade,
  fecha_desde date not null,
  fecha_hasta date not null,
  motivo text not null,
  nota text,
  created_at timestamptz not null default now(),
  constraint upbq_nov_fechas check (fecha_hasta >= fecha_desde)
);
create index on public.upbq_alquiler_novedades (alquiler_id);

create table public.upbq_recordatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid references public.upbq_clientes(id) on delete cascade,
  cotizacion_id uuid references public.upbq_cotizaciones(id) on delete cascade,
  texto text not null,
  fecha date not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecho','negocio_cae')),
  auto boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.upbq_recordatorios (estado, fecha);

create table public.upbq_pendientes (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  fecha date,
  prioridad text not null default 'media' check (prioridad in ('baja','media','alta')),
  hecho boolean not null default false,
  created_at timestamptz not null default now()
);

create function public.upbq_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger upbq_clientes_touch before update on public.upbq_clientes
  for each row execute function public.upbq_touch_updated_at();
create trigger upbq_cotizaciones_touch before update on public.upbq_cotizaciones
  for each row execute function public.upbq_touch_updated_at();

do $$
declare t text;
begin
  foreach t in array array['upbq_clientes','upbq_cotizaciones','upbq_maquinas','upbq_alquileres',
    'upbq_alquiler_novedades','upbq_recordatorios','upbq_pendientes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', t||'_auth', t);
  end loop;
end $$;
