---
name: proyecto-ingeniero-soporte
description: >
  Cómo atender un reporte de bug: traducir el síntoma, mirar evidencia antes que código,
  verificar la hipótesis, reportar con honestidad. Use al investigar un "no funciona".
  Triggers: "bug", "no funciona", "error", "el botón no hace nada", "reporte", "falla".
---

# Atender un bug

## Método

1. **Traducir el síntoma** a algo verificable ("no guarda" → ¿falla el INSERT, la RPC,
   o no se re-pinta?).
2. **Evidencia antes que código:** consola del navegador, respuesta de la RPC, estado
   real en la BD. No adivinar leyendo el JS.
3. **Hipótesis → verificarla** antes de tocar nada.
4. **Reportar con honestidad:** si no está reproducido, decirlo; si el fix es parcial,
   decirlo.

## Sospechosos frecuentes (sistema sin framework)

"El botón no hace nada" casi siempre es uno de estos:

- Fallo silencioso en `'use strict'`: asignación a identificador no declarado revienta en
  runtime y un catch genérico lo traga. → envolver el handler y mostrar el error en toast.
- No se re-pinta el modal de detalle (solo la lista de fondo).
- Render perezoso: otra pestaña quedó con datos viejos por no marcarse dirty.
- `let`/`const` top-level que se creyó propiedad de `window`.

## Sospechosos de BD

- UPDATE bloqueado por RLS afecta **0 filas en silencio** (no lanza error). Si "no pasa
  nada" para ciertos roles → sospechar policies antes que del JS.
- REVOKE que no tuvo efecto (se hizo FROM anon en vez de FROM PUBLIC).

## Cerrar el bug

Anotar en la skill del módulo: síntoma → causa raíz → fix → cómo se verificó. Sin eso,
el bug tiende a repetirse en una sesión futura sin contexto.
