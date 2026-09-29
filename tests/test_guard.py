import json, subprocess, os
# Prueba del hook .claude/hooks/guard-ops.py. Ejecutar: python3 tests/test_guard.py
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(os.environ, CLAUDE_PROJECT_DIR=RAIZ)
OPS = "oguxdohmutqgacahcwop"; MIO = "tkekmpxwefjlkwegamfz"
casos = [
 ("git push alcon", {"tool_name":"Bash","tool_input":{"command":"cd /x/OPS-ALCON-ADMI && git push origin main"}}, 2),
 ("heredoc con alcon", {"tool_name":"Bash","tool_input":{"command":"python3 - <<'EOF'\nprint('alcon git push rm')\nEOF"}}, 0),
 ("rm en alcon", {"tool_name":"Bash","tool_input":{"command":"rm -rf /x/alcon/js"}}, 2),
 ("grep alcon (lectura)", {"tool_name":"Bash","tool_input":{"command":"grep -r foo /x/alcon"}}, 0),
 ("id ops en curl", {"tool_name":"Bash","tool_input":{"command":"curl https://%s.supabase.co/rest/v1/x" % OPS}}, 2),
 ("Edit ruta ajena alcon", {"tool_name":"Edit","tool_input":{"file_path":"/x/OPS-ALCON-ADMI/a.js"}}, 2),
 ("Edit hook propio", {"tool_name":"Edit","tool_input":{"file_path":RAIZ + "/.claude/hooks/guard-ops.py"}}, 0),
 ("OPS execute_sql", {"tool_name":"mcp__Supabase__execute_sql","tool_input":{"project_id":OPS,"query":"select 1"}}, 2),
 ("OPS apply_migration", {"tool_name":"mcp__Supabase__apply_migration","tool_input":{"project_id":OPS,"query":"x"}}, 2),
 ("OPS list_tables (lectura)", {"tool_name":"mcp__Supabase__list_tables","tool_input":{"project_id":OPS}}, 0),
 ("propia apply_migration", {"tool_name":"mcp__Supabase__apply_migration","tool_input":{"project_id":MIO,"query":"x"}}, 0),
 ("otro proyecto execute_sql", {"tool_name":"mcp__Supabase__execute_sql","tool_input":{"project_id":"zzz","query":"x"}}, 2),
 ("GH push_files alcon", {"tool_name":"mcp__github__push_files","tool_input":{"owner":"a","repo":"OPS-ALCON-ADMI"}}, 2),
 ("GH get_file alcon (lectura)", {"tool_name":"mcp__github__get_file_contents","tool_input":{"owner":"a","repo":"OPS-ALCON-ADMI"}}, 0),
 ("GH push_files propio", {"tool_name":"mcp__github__push_files","tool_input":{"owner":"montes009","repo":"Modulo_Entrega"}}, 0),
 ("git push propio", {"tool_name":"Bash","tool_input":{"command":"git push -u origin ccr-2d00580a-cxhcrs"}}, 0),
]
mal = 0
for n, payload, esperado in casos:
    r = subprocess.run(["python3", ".claude/hooks/guard-ops.py"], input=json.dumps(payload), text=True, capture_output=True, env=env, cwd=RAIZ)
    ok = r.returncode == esperado
    mal += not ok
    print(("OK  " if ok else "FAIL"), n, "-> exit", r.returncode, "(esperado %d)" % esperado)
print("fallos:", mal)
