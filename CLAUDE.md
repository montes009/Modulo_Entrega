# CLAUDE.md

Reglas **durables** del repo — **UP Barranquilla · Panel de Coordinación de Sede**.
App personal del coordinador de la sede UP Barranquilla: agenda operativa + tablero de
control para no dejar escapar nada durante la fase de prueba de 2 meses.
Stack: **JS vanilla (sin build) + Supabase (Auth + Postgres + Storage)**.

> Este repo se **repurpuso desde cero**: el `main` se vació del antiguo *Módulo de Entrega
> de Equipos* y ahora aloja el sistema UP Barranquilla. La arquitectura base se **toma de
> ALCON OPS** (lo que ya funciona) pero **simplificada**: sin multi-tenant completo, sin
> roles, sin RLS avanzada, sin cortes de facturación. Solo login por ahora.
> El prompt maestro de diseño vive en `PROMPT_UP_Barranquilla.pdf` (raíz).

## Regla dura: ALCON OPS es INTOCABLE desde este repo

**Prohibido escribir o modificar el repo de ALCON OPS (`OPS-ALCON-ADMI`) y su base de datos**
(Supabase `oguxdohmutqgacahcwop`). Solo se permite **leer** para consultar cómo se hizo algo.
- Este repo trabaja únicamente sobre el proyecto Supabase **`Modulo_Entrega`** (`tkekmpxwefjlkwegamfz`).
- Se hace cumplir con el hook `.claude/hooks/guard-ops.py` (PreToolUse, registrado en
  `.claude/settings.json`): bloquea migraciones/SQL/edge functions en cualquier proyecto que no
  sea `Modulo_Entrega`, escrituras GitHub sobre repos "alcon", Write/Edit en rutas "alcon" fuera
  de este proyecto, y comandos Bash de escritura (`git push`, `rm`, `curl -X POST`…) con "alcon".
- No desactivar ni editar el hook para saltarse la regla. Si alguna vez hay que tocar ALCON, lo
  autoriza el usuario explícitamente y se hace en una sesión propia de ese repo.
- Límites conocidos: detecta por nombre/ID (`alcon`, `oguxdohmutqgacahcwop`), así que un repo
  renombrado sin "alcon" no se detectaría; y como es texto, puede dar falsos positivos (p. ej. un
  `sed` que mencione "alcon"): ante un bloqueo, usar Write/Edit en vez de esquivarlo. Ante duda, preguntar.

## Qué es el sistema

Herramienta de un solo usuario (el coordinador) para administrar la sede: cotizaciones,
cierres, contacto con clientes, próximos alquileres, pendientes, disponibilidad de máquinas
(Gantt), caja menor y una bitácora tipo chat de las negociaciones. **No es solo un
dashboard**: es una agenda viva con recordatorios accionables — de un vistazo, todo.

## Arquitectura: módulos independientes (IIFE + global)

Cada módulo de dominio vive en su propio archivo, envuelto en un IIFE que expone SOLO lo
necesario a `window`:

```js
(function (global) {
  'use strict';
  // ... estado y funciones privadas ...
  global.MiModulo = { init, render };
})(window);
```

- Exponer explícitamente lo que otro módulo necesita; el consumidor valida con `typeof`
  antes de usar. Preferir exponer cada función donde se define (un bloque de exposición al
  final es frágil: un `ReferenceError` aborta todo el bloque).
- `let`/`const` top-level **NO** son propiedades de `window` (solo `var` y `function`
  top-level lo son). Para compartir estado, exponer un puente explícito.
- **Acciones vía `data-action="..." data-id="..."`** + un único listener delegado por
  documento (`click → closest('[data-action]') → switch`), no decenas de `onclick`.

## Convenciones de JS (siempre aplican)

- **Render perezoso por pestaña:** al marcar algo `dirty`, revisar TODAS las pestañas que
  pintan esos mismos datos, no solo la actual.
- **Re-pintar el modal de detalle**, no solo la lista, tras cualquier acción disparada
  desde ese modal.
- **Nada de `confirm()`/`alert()` nativos** — todo por modal in-app + toast.
- **`esc()`** para TODA interpolación de texto libre dentro de `innerHTML` (una sola
  convención de nombre en todo el repo, para auditar XSS con grep sin falsos negativos).
- Fallos silenciosos en `'use strict'`: envolver handlers en `try/catch` que muestre el
  mensaje exacto en un toast. "El botón no hace nada" casi siempre es un throw silencioso.
- **Cache-busting `?v=` en cada `<script>`**, bumpeado en el MISMO commit que edita el JS.
  Si el cambio agrega markup al `index.html`, avisar hard-refresh (Ctrl+Shift+R) la primera
  vez (el entry point se sirve sin `?v=` propio y la caché es terca).

## Fechas: reglas críticas (heredadas, no negociables)

- **"Hoy" SIEMPRE con un helper anclado a `America/Bogota`** (tipo `today()` vía
  `Intl.DateTimeFormat`), NUNCA `new Date().toISOString()` (UTC) ni `new Date().getDate()`
  (hora del navegador) — ambos desfasan el día después de las 19:00 hora Colombia.
- **Duración de un alquiler = días HÁBILES**: excluir sábados, domingos y festivos de
  Colombia. Reutilizar un único helper de conteo, no reinventar por pantalla.
- Los **días de novedad** (no trabajados: paro, clima) registrados en un alquiler se
  **descuentan** del conteo hábil.

## Módulos del sistema

| Módulo | Archivo (previsto) | Qué hace |
|---|---|---|
| Panel / Agenda | `js/panel.js` | Vista de inicio: recordatorios de hoy/vencidos, alquileres que arrancan/terminan, cotizaciones sin respuesta, clientes en mora, máquinas que se liberan, pendientes libres |
| Cotizaciones | `js/cotizaciones.js` | Registrar, estados, cierres (ganada/perdida + motivo), marcar proforma solicitada, auto-recordatorio de seguimiento |
| Clientes | `js/clientes.js` | Lista con estado (activo/en_mora/bloqueado/prospecto/inactivo), filtro, historial de contacto |
| Máquinas / Disponibilidad | `js/maquinas.js` | Vista **Gantt**: fila por máquina, barras por alquiler activo (cliente/inicio/fin), días hábiles, notas de novedad |
| Caja menor | `js/caja.js` | **Esqueleto vacío** hasta que el usuario entregue el formato |
| Bitácora de Negociaciones | `js/negociaciones.js` | Visor tipo chat, **un hilo por cliente**, filtro por mes, texto+imágenes+PDF, carga manual (formulario **y** import de export WhatsApp/JSON) |

## Modelo único de estados (una sola fuente de verdad)

Cada vocabulario de estado vive como **constante en JS + `CHECK` en la BD**, sincronizados
siempre. Nunca dos listas que puedan divergir.

- **Cotización:** `borrador`, `enviada`, `en_seguimiento`, `cerrada_ganada`, `cerrada_perdida`.
- **Cliente:** `activo`, `en_mora`, `bloqueado`, `prospecto`, `inactivo`.
- **Recordatorio:** `pendiente`, `hecho`, `negocio_cae`.
- **Alquiler:** `activo`, `finalizado` (mínimo; ampliar solo si el negocio lo pide).

## Modelo de datos (Supabase — prefijo `upbq_`)

Misma base de Supabase del repo; **todas las tablas nuevas con prefijo `upbq_`** para no
chocar con nada preexistente. Sin `empresa_id` (un solo tenant). Migraciones versionadas.

`upbq_clientes`, `upbq_cotizaciones`, `upbq_maquinas`, `upbq_alquileres`,
`upbq_alquiler_novedades`, `upbq_recordatorios`, `upbq_pendientes`,
`upbq_negociaciones` (un hilo por cliente), `upbq_negociacion_mensajes` (mensajes/adjuntos),
`upbq_caja_*` (esqueleto). Estados con `CHECK` que espejen las constantes JS.

## Almacenamiento (imágenes y PDFs de negociaciones)

- **Bucket privado**, nunca público. Acceso por `createSignedUrl` de corta duración.
- Guardar **`storage_path`, NUNCA una URL absoluta** (las firmadas expiran).
- Validar MIME y tamaño en cliente; comprimir imágenes antes de subir.

## Seguridad (deliberadamente mínima por ahora)

- **Solo login** (Supabase Auth), un único usuario coordinador. Sin roles, sin multi-empresa.
- RLS simple: tablas `upbq_*` accesibles solo por usuario autenticado. Escritura directa
  desde el cliente permitida en esta fase — **sin RPCs `SECURITY DEFINER`** salvo que algo
  lo exija de verdad. No sobre-diseñar; dejar la puerta abierta a endurecer después.
- **La bitácora de negociaciones NO conecta con nada externo**: sin WhatsApp API, sin
  agente, sin terceros. La data se carga 100% a mano (tokens de la cuenta Pro para
  generar/estructurar), dirigida desde Claude Code / Claude chat.

## Deploy

- Rama principal: **`main`**. Trabajar en ramas de feature y llevar a `main` cuando el
  usuario lo autorice (`git push origin <rama>:main`, fast-forward).
- Hosting: **Static Site (Render)** con auto-deploy desde `main`. **Sitio ESTÁTICO SIN
  build**: `index.html` en la raíz, Publish Directory `.`, sin `dist`.
- Cache-busting `?v=` en cada `<script>` (ver convenciones).

## Índice de skills

- `upbq-panel-agenda` — la vista de inicio/agenda: qué resume, recordatorios y pendientes.
- `upbq-cotizaciones` — cotizaciones, estados, cierres, proforma, auto-recordatorio.
- `upbq-clientes` — lista de clientes por estado (mora/activo/bloqueado…), contacto.
- `upbq-maquinas-disponibilidad` — el Gantt, días hábiles, novedades por alquiler.
- `upbq-caja-menor` — esqueleto de caja (a la espera del formato del usuario).
- `upbq-negociaciones` — visor tipo chat, hilos por cliente, carga manual/import.
- `upbq-cambio-bd` — plantilla de migración/tabla/RLS simple para el proyecto.
- `upbq-pendientes` — lista única de pendientes y estado en vivo (punto de partida).

> **Disciplina:** actualizar memoria/skills es parte del "hecho" de una tarea, no un paso
> opcional. Un bug corregido sin dejar la lección escrita tiende a repetirse.
