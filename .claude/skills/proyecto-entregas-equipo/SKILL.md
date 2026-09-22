---
name: proyecto-entregas-equipo
description: >
  Use when working on the Entrega de Equipos module: checklist, firma digital,
  generación de PDF del acta, fotos del equipo. Triggers: "entrega", "checklist",
  "firma", "acta", "foto del equipo".
---

# Entrega de equipos — modulo_operador

Módulo para registrar la entrega de un equipo a un cliente: checklist configurable por
tipo de equipo, fotos de evidencia, firma de quien entrega y quien recibe, y acta en PDF
trazable. Estado del acta con transición controlada (`borrador → en_proceso → firmada`;
`anulada` desde cualquiera con motivo).

## Modelo de datos

Tablas en `supabase/migrations/0001_init_entregas_equipo.sql`:
`entregas_equipo` (encabezado), `_checklist_templates`, `_checklist_items`, `_fotos`,
`_firmas`, `_historial`. Todas con `empresa_id` + RLS por `get_empresa_id_actual()`.
Escritura sensible SOLO por RPC SECURITY DEFINER (ver `proyecto-cambio-bd`).

## Flujo funcional

1. Crear acta (`borrador`), plantilla de checklist por tipo de equipo.
2. Completar checklist: OK / Observación / No aplica + foto si el ítem la exige. Guardado incremental.
3. Cerrar checklist → RPC valida obligatorios (y fotos) → `en_proceso`.
4. Firma de quien entrega (canvas → PNG → bucket privado, RPC registra firma 1).
5. Firma de quien recibe (mismo mecanismo; puede ser link remoto).
6. Al registrar la 2ª firma, la RPC pasa a `firmada` en la MISMA transacción.
7. "Imprimir acta" → PDF desde datos YA persistidos (`print/print_acta.html`).

## Decisiones de diseño tomadas

- 2026-09-22 Lógica pura (checklist/estados/firma) separada del DOM — para testear con
  node:test cargando el .js real. Motivo: el test debe fallar si cambia producción.
- 2026-09-22 PDF vía página HTML de impresión (cliente), no Edge Function — no hay
  requisito de envío automático por correo/WhatsApp (Manual 8). Revisar si eso cambia.

## RPCs implementadas (0002, aplicadas a Supabase)

Todas SECURITY DEFINER, escritura sensible ÚNICA vía. Validan empresa + estado + campos:
- `crear_entrega_equipo(equipo, cliente, recibido_por, cedula?, obs?)` → uuid (borrador).
- `guardar_checklist_item(entrega, item?, titulo, respuesta?, obs?, oblig?, foto_oblig?)` → uuid
  (upsert; solo en borrador).
- `registrar_foto(entrega, storage_path, item?)` → uuid (borrador/en_proceso).
- `cerrar_checklist(entrega)` → void (borrador→en_proceso; valida obligatorios + foto_obligatoria).
- `registrar_firma(entrega, rol, nombre, storage_path, acta_hash, doc?)` → text; 2ª firma →
  firmada en la misma transacción. `unique(entrega_id, rol)` impide doble firma del rol.
- `anular_entrega(entrega, motivo)` → void (solo admin/supervisor; motivo obligatorio).
- Helper `get_rol_actual()`. Todas: revoke public+anon, grant authenticated (verificado).

## Bugs reales encontrados y su causa raíz

- (ninguno todavía — anotar aquí síntoma → causa → fix → cómo se verificó)

## Pendientes / deuda conocida

- Ver `proyecto-pendientes`.
