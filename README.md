# modulo_operador — Entrega de Equipos

Módulo para registrar la **entrega de equipos/maquinaria** a un cliente: checklist
digital configurable, fotos de evidencia, **firma electrónica** de quien entrega y quien
recibe, e impresión del **acta en PDF**. Multi-tenant (aislado por empresa) desde el
día 1.

Stack: **JS vanilla (sin build) + Supabase (Postgres + Auth + Storage)**. Frontend
estático desplegable en cualquier Static Site con auto-deploy desde `main`.

> Levantado siguiendo el *Manual de Seguridad y Estructuración de Proyecto* basado en la
> arquitectura de producción de ALCON OPS. Las reglas durables están en
> [`CLAUDE.md`](./CLAUDE.md) y en `.claude/skills/`.

## Estructura

```
index.html                     HTML de entrada (servir con Cache-Control: no-cache)
src/js/                        módulos IIFE: config, util, estados, checklist, firma, entregas, app
src/css/styles.css             estilos
print/print_acta.html          página de impresión del acta (abrir por URL directa)
supabase/migrations/           0001 esquema + RLS · 0002 plantilla de RPCs SECURITY DEFINER
tests/                         node:test cargando los .js reales del frontend
.claude/skills/                memoria por tema (empezar por proyecto-pendientes)
```

## Comandos

```bash
npm run check   # node --check: prueba SINTAXIS de los módulos
npm test        # node:test: lógica pura (checklist, estados, firma)
```

No hay build step: para ver la app, servir la raíz por HTTP (ej. `python3 -m http.server`)
y completar `src/js/config.js` con las credenciales públicas de Supabase.

## Estado

Andamiaje inicial. Ver pendientes en
[`.claude/skills/proyecto-pendientes/SKILL.md`](./.claude/skills/proyecto-pendientes/SKILL.md).
