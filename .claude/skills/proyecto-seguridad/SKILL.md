---
name: proyecto-seguridad
description: >
  Historial de endurecimiento de seguridad: qué se protegió, por qué, qué falta. Use al
  revisar permisos, RLS, GRANT/REVOKE, manejo de fotos/firmas/datos personales, o al
  hacer una auditoría. Triggers: "seguridad", "RLS", "permisos", "auditoría", "XSS",
  "datos sensibles", "signed url".
---

# Seguridad — historial y reglas vivas

Las reglas duras están en `CLAUDE.md` (secciones Seguridad server-side y Multi-tenant) y
en `proyecto-cambio-bd`. Acá se lleva el historial de qué se endureció y qué queda.

## Principios no negociables (Manual sec. 3, fallas reales)

- Operación sensible → RPC SECURITY DEFINER que valida en servidor. Nunca confiar en el
  frontend ni en un `empresa_id` que mande el cliente.
- `REVOKE ... FROM PUBLIC` (no FROM anon). Verificar con `has_function_privilege`.
- Columna sensible: GRANT por columna + arreglar `select('*')` antes.
- Storage privado + URLs firmadas de corta duración; path con `empresa_id`.
- Doble defensa multi-tenant: RLS (principal) + filtro por `empresa_id` en cada render.
- Cliente: `esc()` en toda interpolación de innerHTML; nada de `confirm/alert` nativos.

## Endurecido hasta ahora

- 2026-09-22 RLS activada en las 6 tablas de negocio desde el primer CREATE TABLE.
  Policies de SELECT filtradas por `get_empresa_id_actual()`. Escritura NO concedida
  directa (irá por RPC).

## Pendiente de seguridad

- Implementar y revocar directo tras desplegar las RPCs (orden seguro, Manual 3.2).
- Crear bucket privado + policies por `empresa_id` antes de la primera foto.
- Definir columnas sensibles (cédula, firma) y aplicar GRANT por columna cuando se expongan.
