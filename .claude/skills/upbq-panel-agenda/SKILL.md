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

## Implementación (hecha · `js/panel.js`)

Widgets: recordatorios de hoy y vencidos (botones Hecho / Negocio cae) · cotizaciones sin respuesta ·
alquileres que arrancan (7 d) · máquinas que se liberan (7 d) · alquileres vencidos sin finalizar ·
negociaciones sin movimiento (cotización abierta + último mensaje ≥ `UPBQ_NEG_SIN_MOVIMIENTO_DIAS`, 7) ·
clientes en mora · pendientes libres (alta rápida y check).
- El Panel **relee todo al entrar a la pestaña** (no hay caché): `U.dirty` es hoy informativo.
- Umbrales en `js/constantes.js`; "hoy" siempre con `UPBQ.today()` (Bogotá).

## ACTUALIZACIÓN 2026-09-29 — el Panel ES la agenda (manda sobre lo anterior)

- **Recordatorios:** crear a mano (`+ Recordatorio`, cliente opcional, chips Hoy/Mañana/+3/+1 sem), **Posponer** (Mañana/+3 d/+1 sem/+2 sem/fecha), Hecho, Negocio cae (solo los ligados a cotización).
- **Pendientes = notas rápidas:** texto (Enter añade) + fecha opcional + prioridad (alta/media/baja); ordenados por prioridad y fecha; fecha vencida en rojo;
  ✓ hecho, ✎ editar, 🗑 borrar (confirma), "Ver hechos" con ↩ reabrir.
- Widgets nuevos: **Aprobadas: montar alquiler**, Alquileres sin equipo asignado, Equipos varados. Todos los ítems navegan a su registro (`pan.ir-alq/cli/neg/maq`, `pan.montar`).
- Pruebas: `tests/smoke_agenda.js`.
