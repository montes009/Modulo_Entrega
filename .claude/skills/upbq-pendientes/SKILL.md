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
  días hábiles + festivos) y Negociaciones (chat + import WhatsApp/JSON). Migraciones `sql/000`–`008`
  aplicadas en Supabase `Modulo_Entrega`. Guard `guard-ops.py` activo. Cache `?v=6/7` (ver CLAUDE.md).
- **Riesgo #1:** TODO se probó con un Supabase simulado (el sandbox bloquea CDNs). **Falta la primera prueba
  con login real y datos reales** (RLS, Storage, subida de adjuntos, import de un chat verdadero).
- **Acceso:** el login del coordinador ya existe (creado 2026-09-29) y es el único autorizado por RLS
  (`upbq_coordinadores`, `sql/005`). La cuenta `operador@…` de la app vieja quedó sin acceso (no borrada).
  Hard-refresh (Ctrl+Shift+R) tras cada despliegue con markup nuevo.
- **Siguiente paso:** (1) prueba real y corrección de lo que salga; (2) **Caja menor** en cuanto el usuario
  entregue el formato — no inventar el flujo.
- **Enfoque agenda aplicado el 2026-09-29** (ver CLAUDE.md "Enfoque del producto"); ya está en `main` (2566379).
- **Estado de `main`:** al día con todo, incluida `sql/005` (RLS solo coordinador), desde 2026-09-29.
- **Datos DEMO: CARGADOS de nuevo (2026-09-29, ampliados):** 6 clientes, 7 máquinas, 7 cotizaciones, 6 alquileres, 3 novedades,
  3 hilos (21 mensajes)… todo marcado `DEMO`. **Borrar antes del uso real:** `sql/demo/demo_limpiar.sql`. Re-sembrar: `sql/demo/demo_seed.sql`.
- **Deuda menor:** añadir festivos 2029 antes de fin de 2028; bucket viejo `entregas-privado` sin usar.

## Estado del rediseño "agenda" (2026-09-29) y lo que falta

Hecho: cotización con días y editable · Aprobada → montar alquiler · Alquileres (tarjetas, equipo opcional sin bloqueos, ALQ-000N) ·
Máquinas = tablero Disponible/Varada con nota · Panel con recordatorios manuales/posponer y pendientes con fecha/prioridad/editar/borrar.

Huecos que siguen abiertos (por prioridad):
1. **Prueba real** con el Supabase de verdad y ajustes visuales que pida el usuario.
2. Negociaciones: editar un mensaje / vincularlo a una cotización después; búsqueda en la lista.
3. Clientes: búsqueda por nombre; registro de contactos (llamadas) más allá de recordatorios.
4. Una novedad no extiende la fecha fin (solo descuenta días netos): decidir si el negocio quiere "extender por novedad".
5. Vista de calendario/semana de la agenda (recordatorios + inicios/fines de alquiler) — solo si el usuario la pide.
6. **Caja menor:** sigue esperando el formato del usuario.

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
