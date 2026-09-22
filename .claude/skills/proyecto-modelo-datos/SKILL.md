---
name: proyecto-modelo-datos
description: >
  Mapa de tablas del proyecto: quién escribe cada una, cómo se aísla por empresa, qué es
  legacy. Use al preguntar por el esquema, relaciones entre tablas, o quién puede
  escribir qué. Triggers: "modelo de datos", "tablas", "esquema", "qué escribe", "FK".
---

# Modelo de datos

Fuente de verdad del esquema: `supabase/migrations/`. Todas las tablas de negocio llevan
`empresa_id` y RLS por `get_empresa_id_actual()` (multi-tenant, doble defensa — Manual 9).

| Tabla | Escribe | Aislamiento | Notas |
|---|---|---|---|
| `entregas_equipo` | RPC (crear/cerrar/firmar/anular) | `empresa_id` | encabezado del acta; estado con CHECK |
| `entregas_equipo_checklist_templates` | RPC `guardar_plantilla` (admin/supervisor) | `empresa_id` | cabecera de plantilla por tipo de equipo |
| `entregas_equipo_checklist_template_items` | RPC `guardar_plantilla_item`/`eliminar_plantilla_item` (admin/supervisor) | `empresa_id` | ítems de la plantilla (0005) |
| `entregas_equipo_checklist_items` | RPC (guardado incremental) | `empresa_id` | respuestas de la entrega puntual; `crear_entrega_equipo` los precarga desde la plantilla activa del tipo |
| `entregas_equipo_fotos` | cliente + validación | `empresa_id` | metadata; binario en bucket privado |
| `entregas_equipo_firmas` | **solo** RPC `registrar_firma` | `empresa_id` | INSERT directo revocado; `unique(entrega_id, rol)` |
| `entregas_equipo_historial` | RPC (en cada transición) | `empresa_id` | bitácora de estados |
| `usuarios_empresas` | (por definir) | — | membresías; la lee `get_empresa_id_actual()` |

## Reglas

- El vocabulario de estados vive en `src/js/estados.js` **y** en el CHECK de la BD,
  sincronizados. Nunca dos listas que puedan divergir.
- `storage_path` siempre relativo (`{empresa_id}/{entrega_id}/{uuid}`), nunca URL absoluta.
- Legacy: (ninguno todavía — el repo se levantó desde cero).
