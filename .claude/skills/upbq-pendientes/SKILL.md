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

- **Fase actual:** CONSTRUCCIÓN (paso 1). Hecho: limpieza de la BD vieja (`sql/000`), migración
  `sql/001_upbq_base.sql` aplicada en Supabase `Modulo_Entrega` (`tkekmpxwefjlkwegamfz`), y
  andamiaje `index.html` + login + nav + Panel + Clientes + Cotizaciones (`?v=1`).
- **Ojo:** el bucket viejo `entregas-privado` sigue ahí (sin políticas). Los 2 usuarios de
  `auth.users` se reciclan. Probado solo con stub de Supabase: falta probar login real.
- **Siguiente paso:** Máquinas/Gantt (+ festivos CO y helper de días hábiles), luego
  Negociaciones (+ bucket privado nuevo) y Caja menor (espera formato).

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
3. Definir festivos de Colombia (tabla o helper) para el conteo de días hábiles.
4. Crear bucket privado de Storage para imágenes/PDFs de negociaciones.

## Riesgos conocidos

- La caché de Render/navegador es el talón de Aquiles: respetar `?v=` y avisar
  hard-refresh cuando cambie el markup de `index.html`.
- Fechas: usar SIEMPRE el helper anclado a `America/Bogota`, nunca UTC ni hora del navegador.

> Al cerrar cualquier tarea, actualizar "Estado global" y mover el pendiente resuelto.
