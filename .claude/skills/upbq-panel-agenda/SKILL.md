---
name: upbq-panel-agenda
description: >
  Módulo Panel / Agenda de UP Barranquilla: la vista de inicio que resume TODO de un vistazo
  (recordatorios de hoy y vencidos, alquileres que arrancan/terminan, cotizaciones sin
  respuesta, clientes en mora, máquinas que se liberan) más los pendientes libres. Use al
  construir o tocar la pantalla de inicio, los recordatorios o los pendientes. Triggers:
  "panel", "agenda", "inicio", "dashboard", "recordatorio", "pendiente", "de un vistazo".
---

# UP Barranquilla — Panel / Agenda

## Propósito

La pantalla de inicio y corazón del sistema: el coordinador la abre y **se entera de todo
sin navegar**. No es un dashboard de gráficas: es una agenda accionable.

## Qué resume (widgets)

- **Recordatorios de hoy y vencidos** (de `upbq_recordatorios`, estado `pendiente`,
  ordenados por fecha). Botón rápido a marcar `hecho` / `negocio_cae`.
- **Alquileres** que **arrancan o terminan** esta semana (de `upbq_alquileres`).
- **Cotizaciones sin respuesta** (`en_seguimiento`/`enviada` sin movimiento reciente).
- **Clientes en mora** (`upbq_clientes.estado = 'en_mora'`).
- **Máquinas que se liberan pronto** (fin de alquiler cercano — cruce con el Gantt).
- **Negociaciones activas sin movimiento reciente** (sugerencia de recontacto).

## Pendientes libres (`upbq_pendientes`)

Notas rápidas del coordinador: texto, fecha, prioridad, check (hecho). CRUD directo.

## Recordatorios (`upbq_recordatorios`)

- Estados: `pendiente`, `hecho`, `negocio_cae` (constante JS + `CHECK` en BD).
- Se generan a mano o **automáticamente** desde Cotizaciones (recontactar en N días).
- Cada recordatorio referencia opcionalmente un cliente y/o una cotización.

## Reglas

- "Hoy" con el helper anclado a `America/Bogota`, nunca UTC.
- El Panel LEE de los otros módulos; marcar `dirty` el panel cuando cambien datos que
  resume (cotización nueva, cliente a mora, alquiler cerrado…).
- Toda interpolación de texto libre va con `esc()`.
