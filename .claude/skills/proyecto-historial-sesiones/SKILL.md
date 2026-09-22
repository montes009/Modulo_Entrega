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
