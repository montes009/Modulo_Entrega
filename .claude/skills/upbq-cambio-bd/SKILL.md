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
