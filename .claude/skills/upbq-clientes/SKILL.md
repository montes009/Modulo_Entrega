---
name: upbq-clientes
description: >
  Módulo Clientes de UP Barranquilla: lista de clientes con estado (activo, en_mora,
  bloqueado, prospecto, inactivo), filtro por estado, datos de contacto e historial de
  recordatorios de contacto. Use al construir o tocar la lista/ficha de clientes o sus
  estados. Triggers: "cliente", "clientes", "en mora", "bloqueado", "prospecto", "estado del
  cliente", "contactar cliente".
---

# UP Barranquilla — Clientes

## Propósito

Tener la cartera de clientes de la sede a la vista, clasificada por estado, para saber a
quién cobrar, a quién contactar y con quién hay negocio.

## Datos (`upbq_clientes`)

- nombre, contacto (teléfono/email), notas.
- **estado**: `activo`, `en_mora`, `bloqueado`, `prospecto`, `inactivo`
  (constante JS única + `CHECK` en BD).

## Vista

- Lista **filtrable por estado** (chips o selector). Los `en_mora` y `bloqueado` resaltados.
- Ficha del cliente: datos + historial de recordatorios de contacto (de `upbq_recordatorios`)
  + sus cotizaciones (de `upbq_cotizaciones`) + acceso a su hilo de negociación.

## Reglas

- Cambiar el estado de un cliente re-pinta la lista **y** marca `dirty` el Panel (widget
  "clientes en mora").
- Toda interpolación de texto libre con `esc()`.
- "Hoy" con el helper `America/Bogota` para cualquier cálculo de antigüedad/mora.

## Implementación (hecha · `js/clientes.js`)

- Chips por estado con conteo; `en_mora` y `bloqueado` con borde rojo. Alta/edición en modal.
- Ficha: datos, notas, cotizaciones y recordatorios del cliente + botón **"Ver negociación"**
  (`cli.hilo` → `UPBQ.irA('neg')` + abre el hilo).
- No se puede borrar un cliente con cotizaciones/alquileres/hilo (FK `on delete restrict`): cambiarle el
  estado a `inactivo`.
