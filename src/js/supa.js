// supa.js — capa de acceso a Supabase (auth + RPCs + storage + selects).
// Toda escritura sensible va por RPC (nunca INSERT/UPDATE directo). Los selects listan
// columnas EXPLÍCITAS, nunca select('*') (Manual 3.4).
(function (global) {
  'use strict';

  var CONFIG = global.CONFIG || {};
  var _client = null;

  function client() {
    if (_client) return _client;
    if (!global.supabase || typeof global.supabase.createClient !== 'function') {
      throw new Error('supabase-js no cargó (revisa el <script> del CDN)');
    }
    if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
      throw new Error('Supabase no configurado (completa src/js/config.js)');
    }
    _client = global.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return _client;
  }

  // --- RPC (única vía de escritura sensible) ---
  async function rpc(fn, args) {
    var r = await client().rpc(fn, args || {});
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  // --- Auth ---
  async function sesion() {
    var r = await client().auth.getSession();
    if (r.error) throw new Error(r.error.message);
    return r.data ? r.data.session : null;
  }
  function alCambiarAuth(cb) { return client().auth.onAuthStateChange(cb); }
  async function login(email, password) {
    var r = await client().auth.signInWithPassword({ email: email, password: password });
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function logout() {
    var r = await client().auth.signOut();
    if (r.error) throw new Error(r.error.message);
  }

  // --- Storage (bucket privado; lectura por URL firmada de corta duración) ---
  async function subir(path, file, contentType) {
    var r = await client().storage.from(CONFIG.STORAGE_BUCKET)
      .upload(path, file, { contentType: contentType, upsert: false });
    if (r.error) throw new Error(r.error.message);
    return path;
  }
  async function urlFirmada(path, segundos) {
    var r = await client().storage.from(CONFIG.STORAGE_BUCKET)
      .createSignedUrl(path, segundos || 60);
    if (r.error) throw new Error(r.error.message);
    return r.data.signedUrl;
  }

  // --- Selects (columnas explícitas) ---
  async function empresaDelUsuario() {
    // Embeber el nombre de la empresa vía la FK usuarios_empresas.empresa_id → empresas.id.
    var r = await client().from('usuarios_empresas')
      .select('empresa_id,rol,activo,empresas(nombre)').eq('activo', true).limit(1);
    if (r.error) throw new Error(r.error.message);
    var row = (r.data && r.data[0]) || null;
    if (row && row.empresas) { row.empresa_nombre = row.empresas.nombre; }
    return row;
  }
  async function listarEntregas() {
    var r = await client().from('entregas_equipo')
      .select('id,equipo_id,cliente_nombre,estado,fecha_entrega,empresa_id')
      .order('fecha_entrega', { ascending: false });
    if (r.error) throw new Error(r.error.message);
    return r.data || [];
  }
  async function detalleEntrega(id) {
    var r = await client().from('entregas_equipo')
      .select('id,equipo_id,cliente_nombre,cliente_cedula,recibido_por,estado,' +
              'fecha_entrega,observaciones,acta_pdf_hash,empresa_id')
      .eq('id', id).limit(1);
    if (r.error) throw new Error(r.error.message);
    return (r.data && r.data[0]) || null;
  }
  async function listarChecklist(entregaId) {
    var r = await client().from('entregas_equipo_checklist_items')
      .select('id,titulo,respuesta,observacion,obligatorio,foto_obligatoria')
      .eq('entrega_id', entregaId).order('created_at', { ascending: true });
    if (r.error) throw new Error(r.error.message);
    return r.data || [];
  }
  async function listarFirmas(entregaId) {
    var r = await client().from('entregas_equipo_firmas')
      .select('rol,nombre,firmado_en')
      .eq('entrega_id', entregaId);
    if (r.error) throw new Error(r.error.message);
    return r.data || [];
  }

  global.Supa = {
    client: client,
    rpc: rpc,
    sesion: sesion,
    alCambiarAuth: alCambiarAuth,
    login: login,
    logout: logout,
    subir: subir,
    urlFirmada: urlFirmada,
    empresaDelUsuario: empresaDelUsuario,
    listarEntregas: listarEntregas,
    detalleEntrega: detalleEntrega,
    listarChecklist: listarChecklist,
    listarFirmas: listarFirmas
  };
})(window);
