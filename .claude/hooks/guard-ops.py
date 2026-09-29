#!/usr/bin/env python3
"""Guard PreToolUse: este repo NO puede escribir/modificar ALCON OPS (repo ni BD).

Bloquea (exit 2) cuando la herramienta:
  - Supabase mutante apunta a un proyecto distinto de Modulo_Entrega (incluye OPS-ALCON-ADMI).
  - Supabase (cualquier tool no de solo lectura) apunta al proyecto de ALCON.
  - GitHub de escritura menciona 'alcon' en owner/repo/ruta.
  - Write/Edit/NotebookEdit toca una ruta con 'alcon' FUERA de este proyecto.
  - Bash ejecuta un comando de escritura (git push/commit, gh, curl POST, rm/mv/cp...) con
    'alcon', o referencia el ID del proyecto Supabase de ALCON.
La lectura queda permitida. Para levantar la regla hay que editar este archivo a propósito.
"""
import json, os, re, sys

PROYECTO_PERMITIDO = "tkekmpxwefjlkwegamfz"   # Modulo_Entrega
PROYECTO_ALCON = "oguxdohmutqgacahcwop"        # OPS-ALCON-ADMI (prohibido)

SB_MUTANTES = {"apply_migration", "execute_sql", "create_branch", "delete_branch", "merge_branch",
               "rebase_branch", "reset_branch", "deploy_edge_function", "pause_project", "restore_project"}
SB_LECTURA = {"list_tables", "list_migrations", "get_project", "get_project_url", "get_publishable_keys",
              "list_extensions", "list_edge_functions", "get_edge_function", "get_advisors",
              "generate_typescript_types", "query_logs", "list_branches", "search_docs"}
GH_LECTURA = re.compile(r"^(get_|list_|search_|issue_read|pull_request_read|actions_get|actions_list)")


def bloquear(msg):
    sys.stderr.write("🚫 BLOQUEADO por regla del repo (ALCON OPS es solo lectura desde aquí): " + msg + "\n")
    sys.exit(2)


def textos(o):
    if isinstance(o, dict):
        for v in o.values():
            yield from textos(v)
    elif isinstance(o, list):
        for v in o:
            yield from textos(v)
    elif isinstance(o, str):
        yield o


try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)

tool = d.get("tool_name", "")
inp = d.get("tool_input") or {}
alcon = re.compile(r"alcon", re.I)

if tool.startswith("mcp__Supabase__"):
    nombre = tool.split("__", 2)[2]
    pid = inp.get("project_id")
    toca_alcon = pid == PROYECTO_ALCON or any(PROYECTO_ALCON in t for t in textos(inp))
    if toca_alcon and nombre not in SB_LECTURA:
        bloquear("proyecto Supabase OPS-ALCON-ADMI (%s), herramienta %s." % (PROYECTO_ALCON, nombre))
    if nombre in SB_MUTANTES and pid != PROYECTO_PERMITIDO:
        bloquear("%s solo se permite sobre Modulo_Entrega (%s); recibido project_id=%r." % (nombre, PROYECTO_PERMITIDO, pid))

elif tool.startswith("mcp__github__"):
    nombre = tool.split("__", 2)[2]
    if not GH_LECTURA.match(nombre):
        campos = {k: inp.get(k) for k in ("owner", "repo", "repository", "name", "path", "url", "full_name")}
        if any(alcon.search(t) for t in textos(campos)):
            bloquear("escritura GitHub (%s) sobre un repo/ruta de ALCON." % nombre)

elif tool in ("Write", "Edit", "NotebookEdit"):
    ruta = inp.get("file_path") or inp.get("notebook_path") or ""
    propio = os.path.realpath(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
    if alcon.search(ruta) and not os.path.realpath(ruta).startswith(propio + os.sep):
        bloquear("ruta de ALCON: %s" % ruta)

elif tool == "Bash":
    cmd = inp.get("command", "")
    # Ignorar cuerpos de heredoc (texto, no comandos) y mirar solo comandos reales.
    limpio = re.sub(r"<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n.*?\n\s*\1\b", "", cmd, flags=re.S)
    if PROYECTO_ALCON in limpio:
        bloquear("Bash referencia la BD de OPS-ALCON-ADMI: %s" % limpio[:120])
    if alcon.search(limpio):
        for seg in re.split(r"&&|\|\||;|\n|\|", limpio):
            seg = seg.strip()
            if re.match(r"(git\s+(-C\s+\S+\s+)?(push|commit|merge|rebase|reset|checkout\s+-b|remote\s+(add|set-url))\b"
                        r"|gh\s+|curl\b.*(-X\s*(POST|PUT|PATCH|DELETE)|--data|\s-d\s)"
                        r"|(rm|mv|cp|tee|touch|mkdir|sed\s+-i)\b)", seg):
                bloquear("comando Bash de escritura con ALCON: %s" % seg[:120])

sys.exit(0)
