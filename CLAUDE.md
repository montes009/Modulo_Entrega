# CLAUDE.md

Reglas durables del repo **modulo_operador** — **Módulo de Entrega de Equipos**
(checklist digital + firma electrónica + impresión PDF del acta + fotos del equipo).
Stack: **JS vanilla (sin build) + Supabase (Postgres + Auth + Storage)**.

> Este repo se levantó desde cero siguiendo el *Manual de Seguridad y Estructuración
> de Proyecto* basado en la arquitectura de producción de **ALCON OPS**. Las reglas de
> abajo NO son teóricas: nacieron de fallas reales ya corregidas en ese sistema.

## Qué es el sistema

App para registrar la **entrega de equipos/maquinaria** a un cliente: se llena un
checklist configurable por tipo de equipo, se adjuntan fotos, firman quien entrega y
quien recibe, y se genera un **acta en PDF** trazable. Multi-tenant (aislado por
empresa) desde el día 1. Frontend estático + Supabase como backend.

## Arquitectura: módulos independientes (IIFE + global)

Cada módulo de dominio (Entregas, Checklist, Firma...) vive en su propio archivo,
envuelto en un IIFE que expone SOLO lo necesario a `window`:

```js
(function (global) {
  'use strict';
  // ... estado y funciones privadas ...
  global.EntregasEquipo = { abrir, guardar, imprimir };
})(window);
```

- Exponer explícitamente lo que otro módulo necesita; el consumidor valida con
  `typeof` antes de usar. Preferir exponer cada función donde se define (un bloque de
  exposición al final es frágil: un `ReferenceError` aborta todo el bloque).
- `let`/`const` top-level **NO** son propiedades de `window` (solo `var` y
  `function` top-level lo son). Para compartir estado, exponer un puente explícito.
- **Acciones vía `data-action="..." data-id="..."`** + un único listener delegado por
  documento (`click → closest('[data-action]') → switch`), no decenas de `onclick`.

## Convenciones de JS (siempre aplican)

- `let`/`const` top-level NO son propiedades de `window`.
- **Render perezoso por pestaña:** al marcar algo `dirty`, revisar TODAS las pestañas
  que pintan esos mismos datos, no solo la actual.
- **Re-pintar el modal de detalle**, no solo la lista, tras cualquier acción disparada
  desde ese modal (aprobar, firmar, cambiar estado).
- **Nada de `confirm()`/`alert()` nativos** — todo por modal in-app + toast.
- **`esc()`** para TODA interpolación de texto libre dentro de `innerHTML` (una sola
  convención de nombre en todo el repo, para auditar XSS con grep sin falsos negativos).
- Fallos silenciosos en `'use strict'`: envolver handlers en `try/catch` que muestre el
  mensaje exacto en un toast.
- **Cache-busting `?v=` en cada `<script>`**, bumpeado en el MISMO commit que edita el JS.
  Si el cambio agrega markup al HTML de entrada, avisar hard-refresh la primera vez.

## Modelo único de estados del acta de entrega

Una sola fuente de verdad del vocabulario de estados: constante en JS + `CHECK` en la
BD, sincronizados siempre. Nunca dos listas que puedan divergir.

| Estado | Significado | Quién lo pone |
|---|---|---|
| `borrador` | Acta creada, checklist sin terminar | Quien inicia la entrega |
| `en_proceso` | Checklist completo, pendiente de firma(s) | Sistema, al cerrar el checklist |
| `firmada` | Ambas firmas registradas — acta **INMUTABLE** | RPC al recibir la 2ª firma |
| `anulada` | Acta invalidada (se rehace) — nunca se borra | Rol autorizado, con motivo obligatorio |

> Un acta `firmada` es un registro cerrado: nunca se edita en el lugar. Se **anula**
> (con motivo, auditado) y se crea una nueva.

## Seguridad server-side: patrón RPC SECURITY DEFINER

Toda operación sensible (crear entrega, cerrar checklist, registrar firma, anular) va por
una **RPC `SECURITY DEFINER`** que valida en el servidor — nunca confiando en el frontend.
La RPC SIEMPRE valida:

- **Empresa dueña del registro:** pertenece a la misma empresa del usuario autenticado;
  nunca confiar en un `empresa_id` que mande el cliente.
- **Rol autorizado** para la acción (aprobar/anular/firmar).
- **Estado válido** para la transición (no re-firmar un acta ya cerrada sin flujo auditado).
- **Campos obligatorios:** checklist completo antes de generar PDF; firma no vacía.

Reglas duras de Postgres (verificadas en auditorías reales):

- **`REVOKE ... FROM anon` NO alcanza.** Postgres concede `EXECUTE` a `PUBLIC` por
  defecto. Patrón correcto: `REVOKE EXECUTE ON FUNCTION x FROM PUBLIC;` +
  `GRANT EXECUTE ON FUNCTION x TO authenticated;`. Verificar con
  `has_function_privilege('anon', p.oid, 'EXECUTE')` — el REVOKE no avisa si no tuvo efecto.
- **Columnas sensibles:** ocultar con `REVOKE SELECT (col)` NO basta si hay grant de
  tabla completa. Patrón: `REVOKE SELECT ON tabla FROM authenticated;` + `GRANT SELECT
  (todas menos la sensible)`. **Trampa:** rompe cualquier `select('*')` — cambiarlos a
  columnas explícitas ANTES de aplicar el REVOKE.
- **Orden de despliegue seguro:** (a) crear RPC → (b) probarla por impersonación+rollback
  → (c) desplegar el JS que la usa PRIMERO → (d) recién después `REVOKE` del INSERT/UPDATE
  directo. Un cliente con caché vieja verá "permission denied" en vez de corromper datos.
- **Prueba estándar:** impersonación + `ROLLBACK` dentro de una transacción (ver
  `.claude/skills/proyecto-cambio-bd`).

## Almacenamiento (fotos, firmas, PDFs)

- **Bucket privado**, nunca público. Acceso por `createSignedUrl` de corta duración.
- Path SIEMPRE con `empresa_id`: `{empresa_id}/{entrega_id}/{uuid}.jpg` — permite que la
  policy valide sin JOIN. Guardar `storage_path`, **nunca** una URL absoluta (expiran).
- Validar MIME y tamaño en cliente; comprimir imágenes antes de subir.
- Firma: trazo en `<canvas>` → PNG → mismo bucket privado + hash del acta al firmar.

## Multi-tenant, doble defensa obligatoria

Ninguna de las dos sola es suficiente:

1. **RLS en BD (principal):** toda tabla de negocio con `empresa_id` y policy que filtra
   por una función `SECURITY DEFINER` tipo `get_empresa_id_actual()` — nunca un subselect
   directo contra membresías (recursión de RLS). Un UPDATE bloqueado por RLS afecta 0 filas
   en silencio: si "no pasa nada", sospechar de las policies antes que del JS.
2. **Limpieza de estado en cliente (secundaria):** logout limpia TODOS los arrays de datos
   de empresa; además, todo render filtra por `empresa_id` en el punto de pintado (última
   línea de defensa contra fuga entre empresas).

## Deploy

- Rama principal: **`main`**. Trabajar en ramas de feature y mergear a `main`.
- Hosting: **Static Site (Render)** con auto-deploy desde `main`, `Cache-Control: no-cache`
  en el HTML de entrada.
- **⚠️ Sitio ESTÁTICO SIN build.** El sitio se sirve desde la **raíz** del repo
  (`index.html` en la raíz), NO hay paso de build ni carpeta `dist`. Config de Render:

  | Campo | Valor |
  |---|---|
  | Build Command | *(vacío)* — o `npm ci` si algún día hace falta |
  | Publish Directory | **`.`** (la raíz), **NO `dist`** |
  | Root Directory | *(vacío)* |
  | Branch | `main` |

  Ojo (bug real 2026-09-22): el sitio migró de Astro (build → `dist`) a estático puro,
  pero Render quedó con la config vieja (`npm run build` + `dist`). Como ya no existe
  `npm run build`, el deploy fallaba y Render seguía sirviendo el ÚLTIMO deploy bueno
  (la landing vieja). Si "no se ve el cambio", revisar PRIMERO Publish Directory=`.` y
  que Build Command no invoque un build inexistente.
- Cache-busting `?v=` en cada `<script>` (ver convenciones).
- Las páginas de impresión (`print/`) se abren por URL directa y NO llevan `?v=` propio:
  cualquier cambio en ellas requiere avisar hard-refresh (Ctrl+Shift+R) la primera vez.

## Índice de skills

- `proyecto-ingeniero-feature` — construir algo nuevo: qué leer antes, RPC vs escritura directa, tests, deploy.
- `proyecto-ingeniero-soporte` — atender un bug: síntoma → evidencia → hipótesis → reporte honesto.
- `proyecto-cambio-bd` — plantilla de RPC, impersonación+rollback, migraciones, orden de despliegue seguro.
- `proyecto-modelo-datos` — mapa de tablas: quién escribe cada una, aislamiento por empresa, qué es legacy.
- `proyecto-entregas-equipo` — historial del módulo: checklist, firma, fotos, PDF — bugs reales y causa raíz.
- `proyecto-seguridad` — historial de endurecimiento: qué se protegió, por qué, qué falta.
- `proyecto-pendientes` — lista única de pendientes abiertos y riesgos conocidos (punto de partida de cada sesión).
- `proyecto-historial-sesiones` — bitácora cronológica de fixes puntuales sin tema único.

> **Disciplina:** actualizar memoria/skills es parte del "hecho" de una tarea, no un paso
> opcional. Un bug corregido sin dejar la lección escrita tiende a repetirse.
