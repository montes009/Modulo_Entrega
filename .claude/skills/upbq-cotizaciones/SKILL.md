---
name: upbq-cotizaciones
description: >
  Módulo Cotizaciones de UP Barranquilla: registrar cotizaciones, sus estados, marcar cierres
  (ganada/perdida con motivo), marcar clientes con proforma solicitada y generar el
  auto-recordatorio de seguimiento. Use al construir o tocar cotizaciones o su seguimiento.
  Triggers: "cotización", "cotizar", "cierre", "ganada", "perdida", "proforma", "seguimiento",
  "negocio en pie".
---

# UP Barranquilla — Cotizaciones

## Propósito

Registrar y dar seguimiento a las cotizaciones de la sede, y no perder ningún cierre.

## Datos (`upbq_cotizaciones`)

- cliente (FK a `upbq_clientes`), equipo, valor, fecha.
- **estado**: `borrador`, `enviada`, `en_seguimiento`, `cerrada_ganada`, `cerrada_perdida`
  (constante JS única + `CHECK` en BD).
- `proforma_solicitada` (bool + fecha): marcar los clientes a los que ya se les pidió proforma.
- motivo de cierre (obligatorio al pasar a `cerrada_ganada`/`cerrada_perdida`).

## Reglas de negocio

- **Al crear/enviar una cotización, generar automáticamente un recordatorio de seguimiento**
  en `upbq_recordatorios` (recontactar en N días) — así el Panel avisa solo.
- Marcar un cierre re-pinta la lista **y** el modal de detalle si está abierto.
- Al cambiar estado de una cotización, marcar `dirty` el Panel (widget "cotizaciones sin
  respuesta") y, si aplica, el Cliente.
- Toda interpolación con `esc()`; nada de `confirm()`/`alert()` nativos.

## Cruces

- Un cliente con cotización `en_seguimiento` sin movimiento → sugerencia de recontacto en
  el Panel y en la Bitácora de Negociaciones.

## Implementación (hecha · `js/cotizaciones.js`)

- Lista con chips por estado; alta con estado inicial `borrador` o `enviada`. Detalle con acciones:
  marcar enviada / en seguimiento / **proforma solicitada** (guarda fecha) / cerrar ganada o perdida.
- **Auto-recordatorio:** al crear como `enviada` o pasar a `enviada` se inserta un recordatorio `auto=true`
  a `UPBQ_SEGUIMIENTO_DIAS` (3) días. Al cerrar, los recordatorios pendientes de esa cotización pasan a
  `hecho` (ganada) o `negocio_cae` (perdida).
- **Motivo de cierre obligatorio** en UI y en BD (`CHECK upbq_cot_motivo_cierre`).
- Cada acción re-pinta lista **y** detalle. Desde el Panel, "sin respuesta" abre el detalle
  (`cot.ver-desde-panel`). Umbral "sin respuesta" = `UPBQ_SIN_RESPUESTA_DIAS` (5).
- Los mensajes de Negociaciones pueden vincularse a una cotización (badge en el chat).

## ACTUALIZACIÓN 2026-09-29 — enfoque agenda (manda sobre lo anterior)

- La cotización es la **nota del pedido**: cliente + equipo solicitado + **días** + valor (`upbq_cotizaciones.dias`). Se puede **editar**.
- **Aprobada** = `cerrada_ganada` (etiqueta "Aprobada"; no exige motivo: nota opcional, por defecto "Aprobada por el cliente").
  Botones: "Solo aprobar" / **"Aprobar y montar alquiler"** (abre Alquileres con cliente y días prellenados). También "🚀 Montar alquiler" desde el detalle.
- **No aprobada** = `cerrada_perdida` (etiqueta "No aprobada"; motivo obligatorio). **Reabrir** devuelve la cotización a "En seguimiento".
- Chip "🚀 Aprobadas sin alquiler" + badge "Montar alquiler" / "ALQ-000N" en la lista; el detalle enlaza al alquiler (`cot.ver-alq`).
- El Panel muestra "Aprobadas: montar alquiler" con botón directo.
- Pruebas: `node tests/smoke_agenda.js`.
