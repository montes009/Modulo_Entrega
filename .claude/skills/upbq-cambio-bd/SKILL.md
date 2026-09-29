---
name: upbq-cambio-bd
description: >
  Procedimiento para tocar la base de datos de UP Barranquilla (Supabase): crear/editar tablas
  con prefijo upbq_, RLS simple (solo authenticated), migraciones versionadas y bucket de
  Storage. Seguridad mínima: escritura directa desde el cliente permitida, sin RPCs SECURITY
  DEFINER salvo necesidad real. Use ante cualquier cambio de esquema o permisos del proyecto.
  Triggers: "migración", "tabla", "RLS", "supabase", "storage", "cambio de base de datos",
  "upbq_".
---

# UP Barranquilla — Cambios de base de datos

> **Solo `Modulo_Entrega` (`tkekmpxwefjlkwegamfz`).** Nunca escribir en OPS-ALCON-ADMI
> (`oguxdohmutqgacahcwop`): el hook `.claude/hooks/guard-ops.py` lo bloquea; ver `CLAUDE.md`.

## Principio: seguridad MÍNIMA por ahora

Este proyecto es de un solo usuario en fase de prueba. **No sobre-diseñar.** Escritura
directa desde el cliente está bien; solo login. Dejar la puerta abierta a endurecer luego.

## Convenciones

- **Todas las tablas con prefijo `upbq_`.** Sin `empresa_id` (un solo tenant).
- Estados como **`CHECK` que espeje la constante JS** correspondiente (una sola fuente de verdad).
- **Migraciones versionadas** en el repo (`sql/` o `migrations/`, numeradas). No aplicar a
  mano sin dejar el archivo.
- Fechas de negocio: columnas `date` reales cuando se pueda; el cálculo de "hoy"/días hábiles
  vive en JS con ancla `America/Bogota`.

## RLS simple (patrón por tabla)

```sql
alter table upbq_<tabla> enable row level security;
create policy upbq_<tabla>_auth on upbq_<tabla>
  for all to authenticated using (true) with check (true);
```

Un solo usuario autenticado ve/escribe todo. No hace falta función `SECURITY DEFINER` ni
filtro por empresa en esta fase.

## Storage (imágenes/PDFs de negociaciones)

- **Bucket privado**, nunca público. Guardar `storage_path` en BD, jamás URL absoluta.
- Acceso vía `createSignedUrl` de corta duración.

## Cuándo SÍ escalar a RPC `SECURITY DEFINER`

Solo si aparece una operación que de verdad no puede confiar en el cliente (p. ej. un cálculo
sensible o una transición que deba validarse server-side). Hasta entonces, no.

## Checklist de un cambio

1. Escribir la migración versionada.
2. Aplicarla (MCP Supabase o CLI) y verificar con `list_tables`.
3. Sincronizar la constante JS de estados si aplica.
4. Actualizar `upbq-modelo` implícito en `CLAUDE.md` y el pendiente en `upbq-pendientes`.

## Estado y procedimiento real (hecho)

- Migraciones en `sql/000`–`004` (ver tabla en `CLAUDE.md`). Siguiente número libre: **005**. Se escribe el
  archivo en `sql/` y se aplica con el MCP de Supabase (`apply_migration`, mismo contenido) sobre
  `tkekmpxwefjlkwegamfz`; se verifica con SQL de solo lectura (RLS, políticas, buckets).
- **Vistas:** crear con `with (security_invoker = true)` para que respeten la RLS; `revoke ... from anon`
  y `grant select ... to authenticated`.
- **Bucket:** se crea por SQL (`insert into storage.buckets ... public=false, file_size_limit,
  allowed_mime_types`) + una política sobre `storage.objects` filtrando por `bucket_id`. Existente:
  `upbq-negociaciones`. Ruta de objeto: `{negociacion_id}/{uuid}.{ext}`.
- **Al borrar un objeto de Storage que dependa de una función:** las políticas del bucket viejo dependían de
  `get_empresa_id_actual()`; se borraron por nombre (sin CASCADE) antes de soltar las funciones.
- El MCP de Supabase se desconecta a ratos: si falta, reintentar con `ToolSearch` (no asumir error de SQL).
- Deuda conocida: bucket `entregas-privado` (sin políticas) y 2 usuarios de `auth.users` reciclables.
