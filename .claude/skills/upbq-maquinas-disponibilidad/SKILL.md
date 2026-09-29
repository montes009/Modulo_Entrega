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

## Implementación (hecha)

- Festivos en `upbq_festivos` (fecha, nombre; 2026-2028, Ley Emiliani + Semana Santa). Helper único:
  `UPBQ.Habiles` (`js/habiles.js`): `contar(desde, hasta, novedades)` → `{habiles, descontados, netos}`,
  `esHabil`, `esFestivo`, `cubre(hasta)`. No reinventar el conteo en otra pantalla.
- Gantt en `js/maquinas.js`: ventana de 5 semanas, navegación ◀ Hoy ▶, sombreado de fines de semana/festivos.
  El estado libre/alquilada se **deriva** de los alquileres activos (la columna `upbq_maquinas.estado` no se usa).
- Un equipo no admite dos alquileres activos solapados (validación en cliente). Alquiler activo con fin
  pasado se muestra en rojo "vencido sin finalizar" y sale en el Panel.
- Las novedades deben caer dentro del rango del alquiler; descuentan solo días hábiles.

- Añadir festivos de un año nuevo: `insert into upbq_festivos` con una migración (`sql/00X`). Regla usada:
  fijos (1-ene, 1-may, 20-jul, 7-ago, 8-dic, 25-dic); trasladados al lunes siguiente (Emiliani: 6-ene, 19-mar,
  29-jun, 15-ago, 12-oct, 1-nov, 11-nov); Semana Santa (Pascua −3 y −2) y Pascua +43 (Ascensión),
  +64 (Corpus Christi), +71 (Sagrado Corazón).
