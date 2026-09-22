-- 0000_base_multitenant.sql
-- Base multi-tenant: empresas + membresías de usuarios. Debe aplicarse ANTES de 0001
-- (la función get_empresa_id_actual() lee usuarios_empresas).
-- RLS activada en toda tabla desde el primer CREATE TABLE (Manual sec. 12).

-- ============================================================
-- empresas
-- ============================================================
create table if not exists public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  activa     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.empresas enable row level security;

-- ============================================================
-- usuarios_empresas (membresía: qué usuario pertenece a qué empresa y con qué rol)
-- La lee get_empresa_id_actual() con SECURITY DEFINER, así que la policy de esta
-- tabla NO se usa para resolver la empresa del usuario (evita recursión de RLS).
-- ============================================================
create table if not exists public.usuarios_empresas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  rol        text not null default 'operador'
             check (rol in ('admin','supervisor','operador')),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, empresa_id)
);
alter table public.usuarios_empresas enable row level security;

create index if not exists idx_usuarios_empresas_user on public.usuarios_empresas(user_id);

-- El usuario puede ver SUS propias membresías (no las de otros usuarios).
create policy usuarios_empresas_sel_propias
  on public.usuarios_empresas
  for select to authenticated
  using (user_id = auth.uid());

-- Puede ver su(s) empresa(s) — filtra contra sus membresías activas.
create policy empresas_sel_propias
  on public.empresas
  for select to authenticated
  using (
    id in (
      select ue.empresa_id from public.usuarios_empresas ue
      where ue.user_id = auth.uid() and ue.activo
    )
  );

-- Nota: el rol del usuario (admin/supervisor/operador) se lee server-side dentro de las
-- RPCs SECURITY DEFINER para autorizar acciones (aprobar/anular/firmar). El cliente NUNCA
-- decide la autorización por su cuenta.
