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

## Módulos del sistema (todos en `js/`, cargados por `index.html`)

| Módulo | Archivo | Estado | Qué hace |
|---|---|---|---|
| Base | `config.js`, `constantes.js`, `util.js`, `app.js` | ✅ | Config Supabase, **constantes de estados**, helpers (`esc`, `today`, toast, modal, `confirmar`), login + nav + listener delegado |
| Panel / Agenda | `panel.js` | ✅ | Recordatorios de hoy/vencidos, cotizaciones sin respuesta, alquileres que arrancan/terminan/vencidos, clientes en mora, negociaciones sin movimiento, pendientes libres |
| Cotizaciones | `cotizaciones.js` | ✅ | Registrar, estados, cierres (ganada/perdida + motivo), proforma, auto-recordatorio de seguimiento |
| Clientes | `clientes.js` | ✅ | Lista con filtro por estado, ficha (cotizaciones + recordatorios), acceso al hilo de negociación |
| Máquinas | `maquinas.js` + `habiles.js` | ✅ | **Gantt**, alquileres, novedades; `UPBQ.Habiles` = único conteo de días hábiles (festivos en `upbq_festivos`) |
| Negociaciones | `negociaciones.js` + `neg-parser.js` | ✅ | Chat por cliente, filtro por mes, adjuntos en Storage, import WhatsApp (.txt/.zip) y JSON |
| Caja menor | `caja.js` | ⏳ no iniciado | **Esqueleto vacío** hasta que el usuario entregue el formato — no inventar el flujo |

## Modelo único de estados (una sola fuente de verdad)

Cada vocabulario de estado vive como **constante en JS + `CHECK` en la BD**, sincronizados
siempre. Nunca dos listas que puedan divergir.

- **Cotización:** `borrador`, `enviada`, `en_seguimiento`, `cerrada_ganada`, `cerrada_perdida`.
- **Cliente:** `activo`, `en_mora`, `bloqueado`, `prospecto`, `inactivo`.
- **Recordatorio:** `pendiente`, `hecho`, `negocio_cae`.
- **Alquiler:** `activo`, `finalizado` (mínimo; ampliar solo si el negocio lo pide).

## Modelo de datos (Supabase — prefijo `upbq_`)

Proyecto Supabase **`Modulo_Entrega`** (`tkekmpxwefjlkwegamfz`). Todas las tablas nuevas con prefijo
`upbq_`. Sin `empresa_id` (un solo tenant). **Migraciones versionadas en `sql/`** (numeradas; cada una
se aplica en Supabase con el mismo contenido del archivo):

| Archivo | Contenido |
|---|---|
| `000_limpiar_funciones_viejas.sql` | Limpieza del antiguo módulo de entregas (funciones RPC + políticas de su bucket) |
| `001_upbq_base.sql` | `upbq_clientes`, `_cotizaciones`, `_maquinas`, `_alquileres`, `_alquiler_novedades`, `_recordatorios`, `_pendientes` (+ trigger `updated_at`) |
| `002_upbq_festivos.sql` | `upbq_festivos` (Colombia 2026-2028; **añadir 2029 antes de fin de 2028**) |
| `003_upbq_negociaciones.sql` | `upbq_negociaciones` (UNIQUE cliente), `upbq_negociacion_mensajes` (hash único por hilo), bucket privado `upbq-negociaciones` |
| `004_upbq_negociaciones_resumen.sql` | Vista `upbq_negociaciones_resumen` (`security_invoker`) |
| `005_upbq_solo_coordinador.sql` | `upbq_coordinadores` + políticas `*_coord` en todas las tablas y en Storage (reemplazan `*_auth`) |

Pendiente de crear: `upbq_caja_*` (esqueleto, cuando llegue el formato). Estados con `CHECK` que
espejan `js/constantes.js`. Sobras del módulo viejo que **no** se tocaron: bucket `entregas-privado`
y 2 usuarios en `auth.users` (se reciclan para el login).

## Almacenamiento (imágenes y PDFs de negociaciones)

- **Bucket privado**, nunca público. Acceso por `createSignedUrl` de corta duración.
- Guardar **`storage_path`, NUNCA una URL absoluta** (las firmadas expiran).
- Validar MIME y tamaño en cliente; comprimir imágenes antes de subir.

## Seguridad (deliberadamente mínima por ahora)

- **Solo login** (Supabase Auth), un único usuario coordinador. Sin roles, sin multi-empresa.
- RLS: tablas `upbq_*` accesibles **solo por usuarios listados en `upbq_coordinadores`** (migración
  `sql/005`), no por cualquier autenticado: en el mismo Supabase existe otra cuenta (`operador@…`, de la app
  vieja) que ya no tiene acceso. Cambiar de coordinador = `insert/delete` en `upbq_coordinadores` vía
  migración (esa tabla no es escribible desde el cliente). Escritura directa
  desde el cliente permitida en esta fase — **sin RPCs `SECURITY DEFINER`** salvo que algo
  lo exija de verdad. No sobre-diseñar; dejar la puerta abierta a endurecer después.
- **La bitácora de negociaciones NO conecta con nada externo**: sin WhatsApp API, sin
  agente, sin terceros. La data se carga 100% a mano (tokens de la cuenta Pro para
  generar/estructurar), dirigida desde Claude Code / Claude chat.

## Pruebas y lecciones aprendidas

- **Pruebas en el repo (`tests/`)**: `node tests/test_parser.js` (parser de importación) y
  `python3 tests/test_guard.py` (hook de protección) y `node tests/smoke_login.js` (login; requiere Playwright). Correrlas antes de tocar el parser o el hook.
- **El sandbox de Claude Code web bloquea CDNs** (jsDelivr/cdnjs): no se puede probar contra Supabase real ni
  cargar `supabase-js`. Método usado: Playwright con `page.route('**/supabase-js@2')` devolviendo un
  **stub funcional** de Supabase (insert/upsert/únicos/Storage en memoria). Ojo: eso valida la lógica de
  la app, **no** RLS ni el Supabase real — probar con login real antes de dar algo por definitivo.
- **Re-pintar el detalle**: acciones desde un modal → `await render(); detalle(id)` (lista Y modal).
- **`confirmar()` reemplaza el modal abierto**: leer los valores del formulario ANTES de llamarlo.
- **Importación idempotente**: hash por mensaje (`fecha|emisor|tipo|contenido`), UNIQUE por hilo,
  `upsert ... ignoreDuplicates`. Nunca insertar mensajes importados sin hash.
- **Falsos positivos del guard** (`guard-ops.py`): detecta por texto; un `sed`, un mensaje de commit o un
  nombre de archivo que mencione el nombre del repo protegido se bloquea. Usar Write/Edit o reformular; no
  esquivar el hook. Si el guard se bloquea a sí mismo, escribir el archivo nuevo con Write.
- **`hidden` vs `display`**: un `display:grid/flex` en un id/clase ANULA el atributo `hidden` (bug real: el login se
  quedaba a pantalla completa tras entrar). Regla global `[hidden]{display:none!important}` al inicio del CSS; no quitarla.
  Toda acción de red disparable por teclado/clic (login) lleva bandera anti-doble-envío y se ignora `e.repeat`.
  Los logs de Supabase (`query_logs`, fuente `edge_logs`) muestran ráfagas de `grant_type=password`: síntoma de UI que no reacciona.
- Cache-busting actual: scripts y CSS en `?v=3` (`app.js` y `app.css` en `?v=4`). Al agregar markup, avisar hard-refresh (Ctrl+Shift+R).

## Deploy

- Rama principal: **`main`**. Trabajar en ramas de feature y llevar a `main` cuando el
  usuario lo autorice (`git push origin <rama>:main`, fast-forward). Verificar antes con
  `git merge-base --is-ancestor origin/main HEAD`. Primer traslado a `main`: 2026-09-29 (Panel, Clientes,
  Cotizaciones, Máquinas, Negociaciones).
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
