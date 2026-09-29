---
name: upbq-pendientes
description: >
  Lista única de pendientes abiertos, decisiones y estado en vivo del sistema UP Barranquilla
  (Panel de Coordinación de Sede). Punto de partida de CUALQUIER sesión nueva. Use al empezar
  a trabajar, al cerrar una tarea (para anotar lo que quedó) o al preguntar "qué falta / qué
  hay pendiente / en qué vamos". Triggers: "pendientes", "qué falta", "TODO", "en qué vamos",
  "estado del proyecto", "UP Barranquilla".
---

# UP Barranquilla — Pendientes y estado en vivo

## Estado global (actualizar en cada sesión)

- **Fase actual:** CONSTRUCCIÓN. Hecho: BD limpia + `sql/001` (base) + `sql/002` (festivos CO 2026-2028),
  login/nav, Panel, Clientes, Cotizaciones y **Máquinas (Gantt) + helper `UPBQ.Habiles`** (`?v=2`).
- **Ojo:** probado solo con Supabase simulado (el sandbox bloquea el CDN): falta probar login real y
  datos reales. Bucket viejo `entregas-privado` sigue ahí (sin políticas); 2 usuarios en `auth.users` a reciclar.
- **Hard-refresh (Ctrl+Shift+R)** la primera vez: se agregó la pestaña Máquinas al markup.
- **Siguiente paso:** Negociaciones (+ bucket privado nuevo) y Caja menor (espera formato).
- **Festivos:** cargados hasta 2028; añadir 2029 con INSERT en `upbq_festivos` antes de fin de 2028
  (el Gantt avisa si el rango sale de los años cargados).

## Decisiones ya cerradas

- **ALCON OPS intocable** (repo y BD): solo lectura. Hook `.claude/hooks/guard-ops.py` activo.
- Base de datos: **misma Supabase del repo**, tablas con prefijo `upbq_`.
- Máquinas: vista principal **Gantt** (línea de tiempo).
- Negociaciones: **un hilo por cliente**; carga **manual (formulario) + import** (export
  WhatsApp `.txt`/`.zip` o JSON).
- Seguridad: **solo login** por ahora; sin roles ni multi-tenant.
- Caja menor: **esqueleto vacío** hasta que el usuario entregue el formato.
- `main` se empezó **limpio** (se descartó el código viejo del Módulo de Entrega).

## Pendientes abiertos

1. Recibir de parte del usuario el **formato de Caja menor** para diseñar ese módulo.
2. ~~Andamiaje~~ HECHO (Panel, Clientes, Cotizaciones). Falta probar con login real.
3. ~~Festivos de Colombia~~ HECHO (`upbq_festivos` + `js/habiles.js`). Añadir 2029+ a futuro.
4. Crear bucket privado de Storage para imágenes/PDFs de negociaciones.

## Riesgos conocidos

- La caché de Render/navegador es el talón de Aquiles: respetar `?v=` y avisar
  hard-refresh cuando cambie el markup de `index.html`.
- Fechas: usar SIEMPRE el helper anclado a `America/Bogota`, nunca UTC ni hora del navegador.

> Al cerrar cualquier tarea, actualizar "Estado global" y mover el pendiente resuelto.
