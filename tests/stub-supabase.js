// Supabase SIMULADO y funcional para pruebas con Playwright (el sandbox no llega a Supabase real ni a los CDN).
// Soporta select/eq/in/lte/order/limit/single/maybeSingle/insert/upsert/update/delete, los joins que usa la app
// (upbq_clientes(...) y upbq_alquiler_novedades(*)), únicos básicos y Storage en memoria.
// Uso: page.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: stub(seedJS) }))
// `seedJS` se ejecuta después de crear la BD: dispone de DB, hoy (Bogotá, 'YYYY-MM-DD') y add(iso, n).
module.exports = function stub(seedJS) {
  return `
const hoy = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota'}).format(new Date());
const add = (i,n)=>{const d=new Date(i+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const DB = { upbq_clientes:[], upbq_negociaciones:[], upbq_negociacion_mensajes:[], upbq_cotizaciones:[], upbq_festivos:[], upbq_maquinas:[],
  upbq_alquileres:[], upbq_alquiler_novedades:[], upbq_recordatorios:[], upbq_pendientes:[] };
const STORE = new Map(); window.__store = STORE; window.__db = DB; window.__logins = 0; let n = 0, sesion = {};
const uuid = () => 'id-' + (++n);
const DEFAULTS = { upbq_alquileres: { estado:'activo', excluir_sabados:true, excluir_domingos:true, excluir_festivos:true } };
function resumen(){ return DB.upbq_negociaciones.map(h => { const ms = DB.upbq_negociacion_mensajes.filter(m => m.negociacion_id === h.id);
  return { id:h.id, cliente_id:h.cliente_id, mensajes:ms.length, ultima: ms.map(m=>m.fecha).sort().pop() || null }; }); }
function tabla(name){ return name === 'upbq_negociaciones_resumen' ? resumen() : (DB[name] = DB[name] || []); }
function unir(name, r){
  const o = Object.assign({}, r);
  if (name === 'upbq_alquileres' || name === 'upbq_cotizaciones') o.upbq_clientes = DB.upbq_clientes.find(c => c.id === r.cliente_id) || null;
  if (name === 'upbq_alquileres') o.upbq_alquiler_novedades = DB.upbq_alquiler_novedades.filter(x => x.alquiler_id === r.id);
  if (name === 'upbq_alquileres') o.upbq_maquinas = DB.upbq_maquinas.find(m => m.id === r.maquina_id) || null;
  return o;
}
function query(name){
  const st = { op:'select', f:[], ord:[], lim:null, one:false, maybe:false, rows:null, opts:{}, ret:false };
  const api = {
    select(){ if (st.op !== 'select') st.ret = true; return api; },
    eq(c,v){ st.f.push(r => r[c] === v); return api; }, in(c,vs){ st.f.push(r => vs.includes(r[c])); return api; }, lte(c,v){ st.f.push(r => r[c] <= v); return api; },
    order(c,o){ st.ord.push([c, !(o && o.ascending === false)]); return api; }, limit(x){ st.lim = x; return api; },
    single(){ st.one = true; return api; }, maybeSingle(){ st.maybe = true; return api; },
    insert(rows){ st.op = 'insert'; st.rows = [].concat(rows); return api; },
    upsert(rows,o){ st.op = 'upsert'; st.rows = [].concat(rows); st.opts = o || {}; return api; },
    delete(){ st.op = 'delete'; return api; }, update(v){ st.op = 'update'; st.val = v; return api; },
    then(ok, ko){ let out; try { out = exec(); } catch (e) { out = { data:null, error:{ message:e.message, code:e.code } }; } return Promise.resolve(out).then(ok, ko); }
  };
  function exec(){
    const t = tabla(name);
    if (st.op === 'insert' || st.op === 'upsert') {
      const made = [];
      for (const r of st.rows) {
        const dup = (name === 'upbq_negociaciones' && t.some(x => x.cliente_id === r.cliente_id)) ||
                    (name === 'upbq_maquinas' && t.some(x => x.codigo === r.codigo)) ||
                    (name === 'upbq_negociacion_mensajes' && t.some(x => x.negociacion_id === r.negociacion_id && x.hash === r.hash));
        if (dup) { if (st.op === 'upsert' && st.opts.ignoreDuplicates) continue; const e = new Error('duplicate key'); e.code = '23505'; throw e; }
        const row = Object.assign({ id: uuid(), created_at: new Date(Date.now() + t.length).toISOString() }, DEFAULTS[name] || {}, r); t.push(row); made.push(row);
      }
      return { data: st.ret ? (st.one ? made[0] : made) : null, error: null };
    }
    let rows = t.filter(r => st.f.every(f => f(r)));
    if (st.op === 'delete') { rows.forEach(r => t.splice(t.indexOf(r), 1)); return { data: null, error: null }; }
    if (st.op === 'update') { rows.forEach(r => Object.assign(r, st.val)); return { data: null, error: null }; }
    for (const [c, asc] of st.ord.slice().reverse()) rows = rows.slice().sort((a, b) => a[c] === b[c] ? 0 : (a[c] < b[c] ? -1 : 1) * (asc ? 1 : -1));
    if (st.lim) rows = rows.slice(0, st.lim);
    rows = rows.map(r => unir(name, r));
    if (st.one) return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'no rows' } };
    if (st.maybe) return { data: rows[0] || null, error: null };
    return { data: rows, error: null };
  }
  return api;
}
window.supabase = { createClient: () => ({
  auth:{ getSession: async () => ({ data:{ session: sesion } }), signOut: async () => { sesion = null; },
         signInWithPassword: async () => { window.__logins++; await new Promise(r => setTimeout(r, 190)); sesion = {}; return { error:null }; } },
  from: query,
  storage:{ from: () => ({
    upload: async (p, f) => { STORE.set(p, { type: f.type, size: f.size }); return { error: null }; },
    remove: async ps => { ps.forEach(p => STORE.delete(p)); return { error: null }; },
    createSignedUrls: async ps => ({ data: ps.map(p => ({ path: p, signedUrl: 'data:text/plain,ok' })), error: null }),
    createSignedUrl: async p => ({ data: { signedUrl: 'data:text/plain,ok' }, error: null }) }) }
}) };
${seedJS || ''}
`;
};
