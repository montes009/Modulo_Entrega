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

- **Fase actual:** CONSTRUCCIÓN. Hecho: BD limpia + `sql/001` base, `002` festivos, `003` negociaciones
  (+ bucket privado `upbq-negociaciones`), `004` vista resumen; login/nav, Panel, Clientes, Cotizaciones,
  Máquinas (Gantt + `UPBQ.Habiles`) y **Negociaciones** (chat, filtro por mes, import WhatsApp/JSON) (`?v=3`).
- **Ojo:** todo probado solo con Supabase simulado (el sandbox bloquea el CDN): falta probar login real y
  datos reales. Bucket viejo `entregas-privado` sigue ahí (sin políticas); 2 usuarios en `auth.users` a reciclar.
- **Hard-refresh (Ctrl+Shift+R)** la primera vez: cambió el markup (nuevas pestañas/scripts).
- **Siguiente paso:** Caja menor (espera el formato del usuario) y una pasada con datos reales.
- **Festivos:** cargados hasta 2028; añadir 2029 con INSERT en `upbq_festivos`.
- **Import .zip de WhatsApp:** carga JSZip desde cdnjs bajo demanda (única dependencia externa del import).

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
4. ~~Bucket privado de Storage~~ HECHO (`upbq-negociaciones`, 10 MB, imágenes y PDF).

## Riesgos conocidos

- La caché de Render/navegador es el talón de Aquiles: respetar `?v=` y avisar
  hard-refresh cuando cambie el markup de `index.html`.
- Fechas: usar SIEMPRE el helper anclado a `America/Bogota`, nunca UTC ni hora del navegador.

> Al cerrar cualquier tarea, actualizar "Estado global" y mover el pendiente resuelto.
