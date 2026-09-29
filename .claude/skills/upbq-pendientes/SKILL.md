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

- **Fase actual:** CONSTRUIDO Y EN `main` (2026-09-29): Panel, Clientes, Cotizaciones, Máquinas (Gantt +
  días hábiles + festivos) y Negociaciones (chat + import WhatsApp/JSON). Migraciones `sql/000`–`005`
  aplicadas en Supabase `Modulo_Entrega`. Guard `guard-ops.py` activo. Cache `?v=3`.
- **Riesgo #1:** TODO se probó con un Supabase simulado (el sandbox bloquea CDNs). **Falta la primera prueba
  con login real y datos reales** (RLS, Storage, subida de adjuntos, import de un chat verdadero).
- **Acceso:** el login del coordinador ya existe (creado 2026-09-29) y es el único autorizado por RLS
  (`upbq_coordinadores`, `sql/005`). La cuenta `operador@…` de la app vieja quedó sin acceso (no borrada).
  Hard-refresh (Ctrl+Shift+R) tras cada despliegue con markup nuevo.
- **Siguiente paso:** (1) prueba real y corrección de lo que salga; (2) **Caja menor** en cuanto el usuario
  entregue el formato — no inventar el flujo.
- **Estado de `main`:** al día con todo, incluida `sql/005` (RLS solo coordinador), desde 2026-09-29.
- **Deuda menor:** añadir festivos 2029 antes de fin de 2028; bucket viejo `entregas-privado` sin usar.

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
2. **Primera prueba con login y datos reales** (ver Estado global) y corregir hallazgos.
3. Añadir festivos 2029+ (`upbq_festivos`) antes de que termine 2028.
4. (Opcional) Decidir qué hacer con el bucket viejo `entregas-privado`.

### Cerrados
- Andamiaje (login, nav, Panel, Clientes, Cotizaciones) · Máquinas/Gantt · Festivos CO + `UPBQ.Habiles` ·
  Negociaciones + bucket privado `upbq-negociaciones` · regla dura de protección (guard) · traslado a `main`.

## Riesgos conocidos

- La caché de Render/navegador es el talón de Aquiles: respetar `?v=` y avisar
  hard-refresh cuando cambie el markup de `index.html`.
- Fechas: usar SIEMPRE el helper anclado a `America/Bogota`, nunca UTC ni hora del navegador.

> Al cerrar cualquier tarea, actualizar "Estado global" y mover el pendiente resuelto.
