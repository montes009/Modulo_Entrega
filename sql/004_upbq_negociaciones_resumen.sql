-- Resumen por hilo (n.º de mensajes y último mensaje) para la lista y el Panel.
-- security_invoker: respeta la RLS de las tablas base (solo usuario autenticado).
create view public.upbq_negociaciones_resumen with (security_invoker = true) as
select n.id, n.cliente_id, count(m.id)::int as mensajes, max(m.fecha) as ultima
from public.upbq_negociaciones n
left join public.upbq_negociacion_mensajes m on m.negociacion_id = n.id
group by n.id, n.cliente_id;

revoke all on public.upbq_negociaciones_resumen from anon;
grant select on public.upbq_negociaciones_resumen to authenticated;
