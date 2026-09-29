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
