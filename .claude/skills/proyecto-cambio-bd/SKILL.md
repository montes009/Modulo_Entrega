---
name: proyecto-cambio-bd
description: >
  Use for any database change: crear/editar tablas, RPCs, policies RLS, GRANT/REVOKE,
  migraciones Supabase. Triggers: "migración", "RPC", "policy", "RLS", "grant",
  "revoke", "cambio de base de datos", "supabase".
---

# Cambios de base de datos

## Plantilla de RPC SECURITY DEFINER

Toda operación sensible va por RPC (nunca INSERT/UPDATE directo del cliente). La RPC
SIEMPRE valida: empresa dueña (`get_empresa_id_actual()`, nunca un `empresa_id` del
cliente), rol autorizado, estado válido para la transición, campos obligatorios.
Plantilla en `supabase/migrations/0002_rpc_entregas_equipo.sql.example`.

## Prueba estándar: impersonación + rollback

```sql
BEGIN;
SELECT set_config('request.jwt.claims', '{"sub":"<user_uuid>"}', true);
SET LOCAL ROLE authenticated;
SELECT crear_entrega_equipo(...);   -- probar
ROLLBACK;                            -- nunca persistir el dato de prueba
```

`RAISE NOTICE` no siempre es visible: materializar resultados con
`CREATE TEMP TABLE _out AS SELECT ...` + `SELECT * FROM _out` antes del ROLLBACK.

## REVOKE que de verdad revoca

- `REVOKE ... FROM anon` **NO** alcanza. Postgres concede EXECUTE a PUBLIC por defecto.
  Correcto: `REVOKE EXECUTE ON FUNCTION x FROM PUBLIC;` + `GRANT EXECUTE ... TO authenticated;`.
- Verificar SIEMPRE: `SELECT has_function_privilege('anon', 'x(args)', 'EXECUTE');`
  (el REVOKE no falla ni avisa si no tuvo efecto).
- Columna sensible: `REVOKE SELECT ON tabla FROM authenticated;` + `GRANT SELECT (todas
  menos la sensible)`. Antes, cambiar TODOS los `select('*')` a columnas explícitas.

## Orden de despliegue seguro

(a) crear RPC → (b) probar por impersonación+rollback → (c) desplegar el JS que la usa
PRIMERO → (d) recién después revocar el INSERT/UPDATE directo. Así un cliente con caché
vieja ve "permission denied" en vez de corromper datos.

## Versionado de migraciones

Archivos numerados `NNNN_descripcion.sql` en `supabase/migrations/`, en orden. Nunca
editar una migración ya aplicada en producción: agregar una nueva.
