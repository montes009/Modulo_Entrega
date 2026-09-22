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

- 2026-09-22 RLS activada en las 6 tablas de negocio + `empresas` + `usuarios_empresas`
  (8 en total) desde el primer CREATE TABLE. Policies de SELECT filtradas por
  `get_empresa_id_actual()`. Escritura NO concedida directa (irá por RPC).
- 2026-09-22 **Trampa del Manual 3.3 confirmada en producción:** tras
  `revoke execute ... from public` sobre `get_empresa_id_actual()`, `anon` SEGUÍA con
  EXECUTE = true (Supabase concede EXECUTE a anon/authenticated por DEFAULT PRIVILEGES,
  no solo vía PUBLIC). Fix: `revoke execute ... from anon` explícito. Verificado:
  `has_function_privilege('anon', 'public.get_empresa_id_actual()', 'EXECUTE')` = false.
  Lección: SIEMPRE verificar con has_function_privilege tras un REVOKE — no avisa si no
  tuvo efecto. Aplicar el mismo patrón a cada RPC futura.

- 2026-09-22 Bucket `entregas-privado` creado **privado** (public=false) con
  file_size_limit 10 MB y allowed_mime_types (jpeg/png/webp/pdf). Policies sobre
  `storage.objects` acotadas por `bucket_id` + `(storage.foldername(name))[1] =
  get_empresa_id_actual()::text` (el primer segmento del path = empresa_id). Probado por
  impersonación+rollback: subir a mi empresa = permitido; subir a path de OTRA empresa =
  bloqueado por RLS. Lectura siempre por createSignedUrl (nunca público).

## Pendiente de seguridad

- Implementar y revocar directo tras desplegar las RPCs (orden seguro, Manual 3.2).
- Crear bucket privado + policies por `empresa_id` antes de la primera foto.
- Definir columnas sensibles (cédula, firma) y aplicar GRANT por columna cuando se expongan.
