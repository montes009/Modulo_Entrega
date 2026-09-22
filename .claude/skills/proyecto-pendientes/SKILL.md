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

## Abiertos (mejoras, no bloqueantes)

- [ ] Datos del equipo en el acta (marca/modelo/serie/horómetro): hoy solo hay `equipo_id`
      (texto). Falta una tabla/RPC de equipos o campos extra en la entrega.
- [ ] Autoservicio de usuarios: hoy se crean por SQL (ver riesgo del login 500). Idealmente
      registro/invitación vía Auth Admin API o un panel de admin.
- [ ] (Opcional) Enviar el PDF por correo/WhatsApp al cerrar → requeriría Edge Function
      (hoy el PDF se imprime bajo demanda desde la página de impresión).
- [ ] Comprimir/redimensionar fotos en el cliente antes de subir (Manual 6): hoy se sube tal cual.

## Datos de acceso / entorno (memoria operativa)

- Proyecto Supabase: **Modulo_Entrega** (`tkekmpxwefjlkwegamfz`). Repo GitHub renombrado a
  `montes009/Modulo_Entrega` (la URL vieja `montes009/modulo_operador` redirige).
- Producción (Render): **modulo-operador.onrender.com** (estático desde `main`, Publish Dir `.`).
- Usuarios de prueba (empresa **Alcon Ops**): `orlandosmg09@gmail.com` (admin) y
  `operador@alcon.co` (operador). Contraseñas fijadas en sesión; rotar si se comparten.
- Plantilla demo sembrada: tipo **retroexcavadora** (5 ítems, 1 con foto obligatoria).

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
- [x] Migración 0003: bucket privado entregas-privado + policies por empresa (path segment).
- [x] Frontend cableado: supa.js (auth+rpc+storage+selects), entregas.js (crear/checklist/
      fotos/cerrar/firma-canvas/anular/imprimir), app.js (gating de auth + delegación
      click/change), login + modales en index.html/util.js, firma en canvas. Smoke test:
      login visible y módulos cargan aun si el CDN falla (init resiliente).
- [x] `print/print_acta.html` completo: carga el acta persistida (cabecera, checklist con
      observaciones, fotos y firmas por URL firmada, hash de integridad en el pie). Usa la
      sesión compartida por localStorage; RLS aplica. Smoke test sin errores de sintaxis.
- [x] PR #4: badge con nombre de empresa; migración 0004 (crear entrega solo admin/supervisor).
- [x] Plantillas de checklist por tipo de equipo (migración 0005 + plantillas.js): admin/
      supervisor crean plantillas; al crear entrega de un tipo, el checklist se PRECARGA.
      Probado por impersonación 5/5.
- [x] Migraciones 0000–0005 aplicadas al proyecto; PRs #3–#6 mergeados a `main` (Render en vivo).
- [x] Verificado en vivo end-to-end en el navegador (login admin/operador, badge, detalle,
      permisos por rol). Falta solo probar el flujo completo hasta PDF con datos reales.
