---
name: proyecto-historial-sesiones
description: >
  Bitácora cronológica de fixes puntuales que no encajan en un tema único. Use para
  registrar o consultar qué se hizo en sesiones pasadas. Triggers: "historial",
  "qué se hizo", "sesión anterior", "changelog", "bitácora".
---

# Historial de sesiones

Bitácora cronológica de cambios puntuales. Los temas grandes viven en su propia skill
(entregas-equipo, seguridad, cambio-bd); acá van los fixes sueltos.

## 2026-09-22 — Arranque del repo

- Se borró la landing Astro vieja del repo por completo.
- Se levantó el proyecto de **Entrega de Equipos** desde cero siguiendo el Manual de
  Seguridad y Estructuración basado en ALCON OPS: estructura de módulos IIFE, `CLAUDE.md`
  raíz (Anexo A), migración `0001` con las 6 tablas + RLS, plantilla de RPCs `0002`,
  página de impresión del acta, harness de tests con `node:test`, y las 8 skills del
  índice de la sección 11.
- Backend completo en Supabase (`Modulo_Entrega`, tkekmpxwefjlkwegamfz): migraciones
  0000 (base multi-tenant), 0001 (tablas+RLS), 0002 (6 RPCs SECURITY DEFINER), 0003
  (bucket privado). Frontend cableado (supa.js/entregas.js/app.js, firma en canvas).
- **Deploy (síntoma "sigue saliendo la página vieja"):** el repo pasó de Astro (build →
  `dist`) a estático puro (raíz, sin build). Render quedó con la config vieja
  (`npm run build` + Publish Directory `dist`); como ya no existe ese build, el deploy
  falla y Render sirve el último bueno (landing vieja). Fix: en Render, Build Command
  vacío + Publish Directory `.`, y mergear el frontend a `main`. Documentado en CLAUDE.md.
- **Login 500 al crear usuario por SQL (GoTrue):** signInWithPassword devolvía HTTP 500
  (no 400). Causa: al insertar en `auth.users` por SQL, las columnas de tokens quedan en
  NULL y GoTrue (Go) revienta al leer NULL en un string ("converting NULL to string is
  unsupported"). Fix: `update auth.users set confirmation_token='', recovery_token='',
  email_change='', email_change_token_new='', email_change_token_current='',
  phone_change='', phone_change_token='', reauthentication_token='' where ...` (todas a
  '' en vez de NULL). Diagnóstico: se vio el 500 en edge_logs (query_logs), no en el
  cliente. LECCIÓN: preferir crear usuarios con la Auth Admin API / Dashboard; si se hace
  por SQL, setear esas columnas a '' en el mismo insert.
- **Permisos por rol (0004/0005):** crear entrega y gestionar plantillas = solo
  admin/supervisor; anular = admin/supervisor; operador hace checklist/fotos/cerrar/firmar.
  Frontend oculta botones por rol, pero la autorización real la imponen las RPCs.
- **Plantillas de checklist (0005):** nueva tabla `_template_items` + `crear_entrega_equipo`
  con `p_tipo_equipo` que precarga el checklist desde la plantilla activa. Sembrada plantilla
  demo `retroexcavadora` (5 ítems) para la empresa Alcon Ops.
- **Merge del stack de 4 PRs (#3→#6):** se encadenaron por rebase (cada uno base=anterior)
  y se mergearon con SQUASH. LECCIÓN: al hacer squash, los commits del padre cambian de SHA
  en `main`, así que el hijo apilado queda en conflicto contra `main`. Fix: NO rebasar toda
  la rama apilada (reaplica commits ya mergeados); crear rama fresca desde `origin/main` y
  `git cherry-pick` SOLO el commit propio del hijo → aplica limpio porque `main` ya tiene el
  contenido del padre. Alternativa a futuro: mergear con "merge commit" en vez de squash, o
  mergear de abajo hacia arriba re-basando el hijo tras cada merge.
- **"No se visualiza nada" (soporte):** el usuario entró como OPERADOR y vio la pantalla casi
  vacía (sin Nueva entrega/Plantillas/Anular) + un acta vieja con checklist vacío. No era bug:
  era el rol correcto. Se sembró la plantilla demo para que el valor fuera visible al entrar
  como admin. LECCIÓN: al mostrar una feature, sembrar datos de ejemplo y aclarar el rol.
- **Estado al cierre:** todo en `main`, Render en vivo (modulo-operador.onrender.com),
  migraciones 0000–0005 aplicadas. Usuarios: admin `orlandosmg09@gmail.com`, operador
  `operador@alcon.co` (empresa Alcon Ops).
