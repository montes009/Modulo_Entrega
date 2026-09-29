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

## Rediseño según el módulo de referencia (2026-09-29) — LEER ANTES DE TOCAR LA UI

- **Vista principal = tarjetas** (una por máquina; estados Alquilada / Reservada / Vencida / Disponible; filtros y Historial). Cada tarjeta
  muestra cliente, ref `ALQ-xxxx`, Inicio · Días (netos) · Vence, badge "Faltan N d / Vence hoy / Venció hace N d / Inicia en N d" y el
  **mapa de días** (chips `dd/mm`: verde trabajado, azul por trabajar, ámbar novedad, rojo excluido, anillo = hoy). El Gantt pasó a "Línea de tiempo".
- **Selector de período (nuevo alquiler y edición):** Fecha de inicio + **Días laborales** → **fecha fin automática**. Botones rápidos 5/10/15/20/30.
  Botones **Excluir: Sábados / Domingos / Festivos CO** (por alquiler, guardados en `excluir_*`). La fecha fin también se puede cambiar a mano o
  **tocando el calendario** (modo "📍 el inicio" / "🏁 el fin"); al tocar el fin, los días laborales se recalculan. KPIs: laborales / excluidos / calendario (/ netos).
- Motor único en `UPBQ.Habiles`: `fechaFin(inicio, n, opts)`, `contar(desde, hasta, novedades, opts)`, `esExcluido`, `opcionesDe(alquiler)`, `motivoExclusion`.
  Ejemplo verificado: inicio lun 28-sep-2026 + 15 días laborales → fin 19-oct (excluye el festivo 12-oct); sin excluir festivos → 16-oct.
- Novedades: siguen descontando días laborales (netos). No se registran/quitan con fechas sin guardar (evita perder la edición).
- Pruebas: `node tests/smoke_maquinas.js` (compara contra una implementación de referencia independiente).

## ACTUALIZACIÓN 2026-09-29 — separación Alquileres / Máquinas (manda sobre lo anterior)

- **Máquinas (`js/maquinas.js`) = tablero visual** de equipos **Disponible / Varada**. Estado manual y libre (botón de un clic), nota rápida
  ("por qué está varada"), info de alquiler solo informativa ("En alquiler: X · hasta…", "⚠ Varada con un alquiler en curso"). Editar/eliminar
  (solo si no tiene alquileres). No hay estado "alquilada": se deriva de los alquileres. Pruebas: `tests/smoke_maquinas.js`.
- **Alquileres (`js/alquileres.js`, pestaña propia)**: tarjetas por alquiler, línea de tiempo, se monta sobre una cotización aprobada (`desde-cot`) o suelto.
  **El equipo es opcional** ("Asignar después") y **nunca se bloquea**: varado u ocupado en las mismas fechas → solo aviso ámbar. Estados libres: Finalizar / Reabrir.
  Número consecutivo `ALQ-0001` (`upbq_alquileres.nro`). Filtros: En curso / Activos / Por iniciar / Vencidos / Sin equipo / Finalizados.
  Pruebas: `tests/smoke_alquileres.js`.
- El selector visual de fechas (secciones anteriores) sigue igual, ahora en Alquileres.
