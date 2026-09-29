-- Qué días NO cuentan como laborales en cada alquiler (igual que excluirSabados/Domingos/Festivos
-- en el módulo de alquileres de referencia). Por defecto se excluyen los tres = comportamiento anterior.
alter table public.upbq_alquileres
  add column excluir_sabados  boolean not null default true,
  add column excluir_domingos boolean not null default true,
  add column excluir_festivos boolean not null default true;
