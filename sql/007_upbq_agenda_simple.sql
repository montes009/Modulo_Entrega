-- Enfoque "agenda + notas rápidas" (definido por el usuario el 2026-09-29):
--  * La cotización lleva los DÍAS solicitados ("un brazo por 15 días, valor X").
--  * El alquiler se monta sobre la cotización aprobada; el equipo se asigna al montarlo o después (puede quedar sin asignar).
--  * El cuadro de máquinas es solo visual: Disponible / Varada, cambiable libremente, con una nota rápida.
alter table public.upbq_cotizaciones
  add column dias integer check (dias is null or dias > 0);

alter table public.upbq_alquileres
  alter column maquina_id drop not null;

alter table public.upbq_maquinas drop constraint if exists upbq_maquinas_estado_check;
update public.upbq_maquinas set estado = 'disponible' where estado not in ('disponible', 'varada');
alter table public.upbq_maquinas
  add constraint upbq_maquinas_estado_check check (estado in ('disponible', 'varada')),
  add column nota text;
