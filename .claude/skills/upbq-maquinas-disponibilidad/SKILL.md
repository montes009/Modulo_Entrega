---
name: upbq-maquinas-disponibilidad
description: >
  Módulo Máquinas / Disponibilidad de UP Barranquilla: la vista Gantt de equipos (fila por
  máquina, barras por alquiler activo con cliente/inicio/fin), el conteo de días HÁBILES
  (excluye sáb/dom/festivos CO) y las notas de novedad por días no trabajados. Use al
  construir o tocar la disponibilidad, el Gantt, los alquileres o el conteo de días.
  Triggers: "máquina", "máquinas", "disponibilidad", "gantt", "alquiler activo", "días
  hábiles", "novedad", "días no trabajados", "equipo libre".
---

# UP Barranquilla — Máquinas / Disponibilidad

## Propósito

Ver de un golpe qué equipo está libre y cuál alquilado, con qué cliente, desde y hasta
cuándo — y llevar bien las cuentas de días trabajados.

## Vista principal: GANTT

- Fila por máquina (`upbq_maquinas`), barras horizontales por alquiler activo
  (`upbq_alquileres`) sobre un calendario.
- Cada barra muestra: **cliente, fecha inicio, fecha fin**. Al hacer clic → detalle del
  alquiler con sus novedades.
- Los huecos entre barras = disponibilidad. Alimenta el Panel ("máquinas que se liberan").

## Días hábiles (regla crítica)

- La duración de un alquiler se cuenta en **días HÁBILES**: excluir **sábados, domingos y
  festivos de Colombia**. Usar un **único helper** de conteo, no reinventar por pantalla.
- **Novedades** (`upbq_alquiler_novedades`): días NO trabajados (paro, clima, avería) con
  **motivo y rango de fechas**, que **se descuentan** del conteo hábil.
- "Hoy" con el helper anclado a `America/Bogota`, nunca UTC ni hora del navegador.

## Datos

- `upbq_maquinas`: identificación del equipo, tipo, estado (mínimo `disponible`/`alquilada`).
- `upbq_alquileres`: máquina, cliente, fecha_inicio, fecha_fin, estado (`activo`/`finalizado`).
- `upbq_alquiler_novedades`: alquiler, fecha_desde, fecha_hasta, motivo, nota.

## Reglas

- Dejar notas en un alquiler re-pinta el detalle abierto, no solo la lista.
- Toda interpolación con `esc()`.
