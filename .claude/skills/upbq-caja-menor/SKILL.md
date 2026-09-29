---
name: upbq-caja-menor
description: >
  Módulo Caja menor de UP Barranquilla. Por ahora es un ESQUELETO VACÍO a la espera de que el
  usuario entregue el formato exacto — no inventar el flujo. Use al construir el andamiaje de
  caja o cuando el usuario entregue el formato. Triggers: "caja", "caja menor", "gasto",
  "formato de caja".
---

# UP Barranquilla — Caja menor

## Estado

**ESQUELETO VACÍO — a la espera del formato del usuario.** No diseñar el flujo hasta
recibirlo. El usuario dijo explícitamente que entregará el formato después.

## Qué construir por ahora

- Solo el andamiaje del módulo: pestaña en la nav, archivo `js/caja.js` en IIFE con
  `init`/`render` que pinte un placeholder ("Módulo en construcción — pendiente formato").
- Opcional: tabla base `upbq_caja_*` sin comprometer estructura definitiva.

## Al recibir el formato

- Modelar la(s) tabla(s) `upbq_caja_*` según el formato real (registrar gasto, saldo,
  soportes, etc.).
- Seguir convenciones del repo: estados como fuente única, `esc()`, modal in-app, `?v=`.
- Fechas con el helper `America/Bogota`.
- Actualizar esta skill con el diseño real y mover el pendiente en `upbq-pendientes`.
