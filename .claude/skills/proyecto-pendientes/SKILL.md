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

- [ ] Cargar el cliente de Supabase (JS, `supabase-js`) y cablear login → `EntregasEquipo.setEmpresa`.
- [ ] Conectar el frontend (`entregas.js`) a las RPCs 0002 (crear/checklist/firmar/anular).
- [ ] Crear el bucket privado `entregas-privado` + policies por `empresa_id`.
- [ ] Sembrar al menos una `empresas` + una fila en `usuarios_empresas` para el usuario real.
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
- [x] Proyecto Supabase `Modulo_Entrega` (tkekmpxwefjlkwegamfz) creado con RLS automático.
- [x] Migraciones 0000 (empresas + usuarios_empresas) y 0001 (6 tablas + policies +
      get_empresa_id_actual) aplicadas. 8 tablas con RLS + policy verificadas.
- [x] Endurecido: `revoke execute ... from anon` sobre get_empresa_id_actual
      (has_function_privilege('anon',...) = false). Ver proyecto-seguridad.
- [x] `src/js/config.js` con URL + publishable key.
- [x] Migración 0002: 6 RPCs SECURITY DEFINER (crear/checklist/foto/cerrar/firmar/anular) +
      get_rol_actual, aplicadas y probadas por impersonación+rollback (9/9 asserts ok).
      revoke public+anon / grant authenticated verificado en las 7 funciones.
