-- 0001_init_entregas_equipo.sql
-- Esquema mínimo viable del Módulo de Entrega de Equipos.
-- Reglas (ver CLAUDE.md / Manual de Seguridad):
--   * RLS activada en TODA tabla desde el primer CREATE TABLE.
--   * empresa_id en toda tabla de negocio (multi-tenant día 1).
--   * Escritura de estados/firmas SOLO por RPC SECURITY DEFINER (no INSERT/UPDATE directo).
--   * Vocabulario de estados en CHECK, sincronizado con src/js/estados.js.

-- ============================================================
-- Helper: empresa del usuario autenticado (SECURITY DEFINER).
-- NUNCA hacer un subselect directo contra la tabla de membresías dentro de una policy
-- (genera recursión de RLS). Se centraliza aquí.
-- ============================================================
create or replace function public.get_empresa_id_actual()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select ue.empresa_id
  from public.usuarios_empresas ue
  where ue.user_id = auth.uid()
  limit 1;
$$;

revoke execute on function public.get_empresa_id_actual() from public;
grant execute on function public.get_empresa_id_actual() to authenticated;

-- ============================================================
-- Tabla: entregas_equipo (encabezado del acta)
-- ============================================================
create table if not exists public.entregas_equipo (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null,                 -- RLS por esta columna
  equipo_id      text not null,
  cliente_id     uuid,
  cliente_nombre text not null,                 -- snapshot al firmar
  cliente_cedula text,
  entregado_por  uuid not null,                 -- usuarios_empresas
  recibido_por   text not null,                 -- snapshot (puede no ser usuario)
  estado         text not null default 'borrador'
                 check (estado in ('borrador','en_proceso','firmada','anulada')),
  fecha_entrega  timestamptz not null default now(),
  observaciones  text,
  acta_pdf_hash  text,                          -- hash del contenido al generar el PDF
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.entregas_equipo enable row level security;

-- ============================================================
-- Plantillas de checklist configurables por tipo de equipo
-- ============================================================
create table if not exists public.entregas_equipo_checklist_templates (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null,
  tipo_equipo  text not null,
  nombre       text not null,
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);
alter table public.entregas_equipo_checklist_templates enable row level security;

-- ============================================================
-- Ítems respondidos de una entrega puntual
-- ============================================================
create table if not exists public.entregas_equipo_checklist_items (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null,
  entrega_id        uuid not null references public.entregas_equipo(id) on delete cascade,
  template_item_id  uuid,
  titulo            text not null,
  respuesta         text check (respuesta in ('ok','observacion','no_aplica')),
  observacion       text,
  obligatorio       boolean not null default true,
  foto_obligatoria  boolean not null default false,
  created_at        timestamptz not null default now()
);
alter table public.entregas_equipo_checklist_items enable row level security;

-- ============================================================
-- Fotos del equipo (metadata; el binario va al bucket privado)
-- ============================================================
create table if not exists public.entregas_equipo_fotos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null,
  entrega_id    uuid not null references public.entregas_equipo(id) on delete cascade,
  item_id       uuid references public.entregas_equipo_checklist_items(id) on delete set null,
  storage_path  text not null,                  -- {empresa_id}/{entrega_id}/{uuid}.jpg
  subida_por    uuid not null,
  subida_en     timestamptz not null default now()
);
alter table public.entregas_equipo_fotos enable row level security;

-- ============================================================
-- Firmas (entrega + recibe). storage_path del PNG en bucket privado.
-- ============================================================
create table if not exists public.entregas_equipo_firmas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null,
  entrega_id    uuid not null references public.entregas_equipo(id) on delete cascade,
  rol           text not null check (rol in ('entrega','recibe')),
  nombre        text not null,
  documento     text,
  storage_path  text not null,
  acta_hash     text not null,                  -- integridad: hash del acta al firmar
  firmado_en    timestamptz not null default now(),
  unique (entrega_id, rol)
);
alter table public.entregas_equipo_firmas enable row level security;

-- ============================================================
-- Historial / bitácora de cambios de estado
-- ============================================================
create table if not exists public.entregas_equipo_historial (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null,
  entrega_id    uuid not null references public.entregas_equipo(id) on delete cascade,
  estado_antes  text,
  estado_despues text not null,
  motivo        text,
  actor         uuid not null,
  registrado_en timestamptz not null default now()
);
alter table public.entregas_equipo_historial enable row level security;

-- ============================================================
-- Policies RLS: SELECT filtrado por empresa en todas las tablas de negocio.
-- (La ESCRITURA se hace por RPC SECURITY DEFINER — ver 0002. No se conceden
--  INSERT/UPDATE directos a authenticated en las tablas protegidas.)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'entregas_equipo',
    'entregas_equipo_checklist_templates',
    'entregas_equipo_checklist_items',
    'entregas_equipo_fotos',
    'entregas_equipo_firmas',
    'entregas_equipo_historial'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (empresa_id = public.get_empresa_id_actual());',
      t || '_sel', t
    );
  end loop;
end $$;

-- Nota: aún NO se hace GRANT SELECT explícito por columna. Cuando se agregue una
-- columna sensible (ej. cédula/firma), seguir el patrón del Manual 3.4:
--   REVOKE SELECT ON tabla FROM authenticated;
--   GRANT SELECT (col1,...,colN) -- todas MENOS la sensible
-- y ANTES cambiar todos los select('*') del frontend a columnas explícitas.
