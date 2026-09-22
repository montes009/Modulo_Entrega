---
name: proyecto-ingeniero-feature
description: >
  Procedimiento para construir algo NUEVO en el proyecto (una función, un flujo, una
  pantalla). Use al empezar a implementar una feature. Triggers: "agregar", "implementar",
  "nueva función", "construir", "feature".
---

# Construir una feature

## Antes de escribir código

1. Leer `proyecto-pendientes` (contexto y riesgos abiertos).
2. Si toca un módulo con historia, leer su skill (`proyecto-entregas-equipo`, etc.).
3. ¿Toca la BD? → `proyecto-cambio-bd` y `proyecto-modelo-datos`.

## Decisiones de diseño

- ¿La operación es sensible (dinero, datos personales, estado protegido)? → va por RPC
  SECURITY DEFINER, no escritura directa.
- ¿Se dispara desde un modal de detalle abierto? → re-pintar ESE modal al terminar.
- ¿Cambia datos compartidos? → marcar dirty TODAS las pestañas que los pintan.
- Módulo nuevo → archivo propio con IIFE + exposición explícita a `window`.
- Acciones nuevas → `data-action` + el switch de `app.js`, no `onclick`.

## Tests propios

- Lógica pura (validaciones, armado de payload, cálculo de completo) → test con
  `node:test` cargando el .js real. `npm test`.
- `npm run check` (node --check) prueba sintaxis, NO comportamiento.
- RPC/policy nueva → impersonación + rollback ANTES de conectarla al frontend.

## Deploy

- Bumpear `?v=` del/los `<script>` editados en el MISMO commit.
- Orden de despliegue seguro para cambios de BD (Manual 3.2).
- Actualizar la skill del módulo y `proyecto-pendientes` — parte del "hecho".
