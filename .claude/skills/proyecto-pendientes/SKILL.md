---
name: proyecto-pendientes
description: >
  Lista única de pendientes abiertos y riesgos conocidos del proyecto de Entrega de
  Equipos. Punto de partida de CUALQUIER sesión nueva. Use al empezar a trabajar, al
  cerrar una tarea (para anotar lo que quedó), o al preguntar "qué falta / qué hay
  pendiente / qué riesgos hay". Triggers: "pendientes", "qué falta", "TODO", "riesgos".
---

# Pendientes y riesgos conocidos

> Se mantiene viva desde el día 1 (Manual sec. 12). Anotar un pendiente aquí es parte
> del "hecho" de cada tarea, no un paso opcional.

## Abiertos (bloqueantes para funcionar)

- [ ] Conectar Supabase: completar `src/js/config.js` (URL + anon key) y crear el proyecto.
- [ ] Crear tabla `usuarios_empresas` (membresías) — la usa `get_empresa_id_actual()`.
- [ ] Implementar las RPCs de `supabase/migrations/0002_*.example` (crear/cerrar/firmar/anular)
      y probarlas por impersonación + rollback antes de conectarlas al frontend.
- [ ] Cargar el cliente de Supabase (JS) y cablear login → `EntregasEquipo.setEmpresa`.
- [ ] Implementar `nueva()`, `abrir()` y el guardado incremental del checklist en `entregas.js`.
- [ ] Captura de firma en canvas (signature_pad o equivalente) + subida al bucket privado.
- [ ] Página de impresión: cargar el acta persistida y pintar cabecera/checklist/firmas/hash.

## Riesgos conocidos

- El bucket de Storage debe crearse **privado** con policies por `empresa_id` ANTES de
  subir la primera foto (Manual 6 / 12).
- Al agregar columnas sensibles (cédula, firma) aplicar el patrón de GRANT por columna
  (Manual 3.4) y cambiar antes todos los `select('*')`.

## Hecho

- [x] Andamiaje inicial del repo según el Manual de Seguridad (estructura, CLAUDE.md,
      migración 0001, skills, tests de lógica pura).
