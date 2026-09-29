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
