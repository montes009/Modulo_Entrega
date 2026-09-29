---
name: upbq-negociaciones
description: >
  Módulo Bitácora de Negociaciones de UP Barranquilla: visor tipo chat, un hilo por cliente,
  con filtro por mes, que muestra texto + imágenes + PDFs de las conversaciones/negociaciones.
  Carga 100% manual (formulario + import de export WhatsApp/JSON); SIN integración externa.
  Use al construir o tocar el visor de chat, los hilos, la carga o el parseo de mensajes.
  Triggers: "negociación", "negociaciones", "chat", "bitácora", "hilo del cliente",
  "importar whatsapp", "conversación", "adjuntos".
---

# UP Barranquilla — Bitácora de Negociaciones (visor tipo chat)

## Propósito

Tener en un solo lugar la foto de cada negociación por mes: un visor estilo mensajería donde
el coordinador revisa cómo evolucionó el trato con cada cliente. **Trazabilidad manual, no
mensajería en tiempo real.**

## Modelo

- `upbq_negociaciones`: **un hilo por cliente** (FK a `upbq_clientes`).
- `upbq_negociacion_mensajes`: hilo, cotización asociada (opcional, FK a `upbq_cotizaciones`),
  fecha/hora, emisor (`cliente` / `nosotros`), tipo (`texto` / `imagen` / `pdf`), contenido
  (texto) o `storage_path` (adjunto), mes de negociación (derivado de la fecha, para el filtro).

## Vista

- Burbujas cronológicas, agrupadas y **filtrables por mes**.
- **Texto**, **imágenes** (inline + lightbox) y **PDFs** (ver/descargar).
- Mensajes vinculados a una cotización se distinguen dentro del hilo único del cliente.

## Carga (dos vías, ambas manuales)

1. **Formulario manual:** pegar texto del chat y adjuntar imágenes/PDFs, por mensaje o en bloque.
2. **Import de archivo:** subir export de WhatsApp (`.txt`/`.zip`) o un JSON estructurado →
   el sistema lo **parsea a burbujas** (emisor, fecha, tipo, adjuntos).

## Almacenamiento

- Imágenes/PDFs a **Supabase Storage, bucket privado**; en BD solo **`storage_path`**, nunca
  URL absoluta (las firmadas expiran). Acceso por `createSignedUrl` de corta duración.
- Validar MIME y tamaño en cliente; comprimir imágenes antes de subir.

## Restricción dura

- **Sin WhatsApp API, sin agente, sin terceros.** La info se carga a mano (tokens de la
  cuenta Pro para generar/estructurar), dirigida desde Claude Code / Claude chat.

## Cruces

- Un hilo con negociación activa este mes sin movimiento reciente → sugerencia de recontacto
  en el Panel.
- Toda interpolación de texto libre con `esc()`.

## Implementación (hecha)

- Tablas `upbq_negociaciones` (UNIQUE cliente_id) y `upbq_negociacion_mensajes`; vista `upbq_negociaciones_resumen`
  (n.º de mensajes y último mensaje por hilo, `security_invoker`). Bucket privado `upbq-negociaciones`.
- `js/neg-parser.js`: `parseWhatsApp` (Android/iOS, 12 h y 24 h, dd/mm y mm/dd, multilínea, adjuntos
  `<adjunto: …>` y `… (archivo adjunto)`, omitidos, líneas de sistema) y `parseJSON`. Fechas = hora de Bogotá (-05:00).
- `js/negociaciones.js`: lista de hilos → chat con burbujas por día, chips por mes (por defecto el más reciente),
  imágenes con lightbox y PDF ver/descargar (URL firmada de 10 min), formulario manual y importador con vista previa.
- **Idempotencia:** cada mensaje lleva `hash` único por hilo → reimportar el mismo export no duplica. Un adjunto
  que falla al subir deja un texto placeholder con hash distinto y se reintenta en el siguiente import.
- Al importar WhatsApp el usuario marca qué remitentes son "Nosotros"; los demás son "Cliente".
- Panel: widget "Negociaciones sin movimiento" (cotización abierta + último mensaje ≥ `UPBQ_NEG_SIN_MOVIMIENTO_DIAS`).
