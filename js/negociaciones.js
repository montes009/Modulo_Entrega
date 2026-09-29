(function (global) {
  'use strict';
  const U = global.UPBQ, P = U.NegParser;
  const BUCKET = 'upbq-negociaciones';
  const MAX_BYTES = 10 * 1024 * 1024;
  const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const MIME_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', pdf: 'application/pdf' };
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const EMISOR = { cliente: 'Cliente', nosotros: 'Nosotros' };
  const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

  const fDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
  const fHora = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dia = iso => fDia.format(new Date(iso));
  const hora = iso => fHora.format(new Date(iso));
  const mesDe = iso => dia(iso).slice(0, 7);
  const etiquetaMes = k => MESES[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4);

  let clientes = [], resumen = new Map();
  let actual = null, hiloId = null, msgs = [], cots = [], mes = null, urls = {}, imp = null;

  // ---------- Lista de hilos ----------
  async function cargarLista() {
    const [c, r] = await Promise.all([
      U.sb.from('upbq_clientes').select('id,nombre,estado').order('nombre'),
      U.sb.from('upbq_negociaciones_resumen').select('*')
    ]);
    if (c.error) throw c.error;
    if (r.error) throw r.error;
    clientes = c.data;
    resumen = new Map(r.data.map(x => [x.cliente_id, x]));
  }
  async function renderLista() {
    await cargarLista();
    const CE = global.UPBQ_EST.cliente;
    const orden = clientes.slice().sort((a, b) => {
      const ua = (resumen.get(a.id) || {}).ultima || '', ub = (resumen.get(b.id) || {}).ultima || '';
      return ua === ub ? a.nombre.localeCompare(b.nombre) : ua < ub ? 1 : -1;
    });
    document.getElementById('vista').innerHTML = '<div class="head"><h2>Negociaciones</h2></div>' +
      (orden.length ? '<div class="list">' + orden.map(c => {
        const r = resumen.get(c.id);
        return '<div class="item" data-action="neg.abrir" data-id="' + esc(c.id) + '"><b>' + esc(c.nombre) + '</b><span class="badge ' + esc(c.estado) + '">' + esc(CE[c.estado]) + '</span>' +
          '<small>' + (r && r.mensajes ? r.mensajes + ' mensajes · último ' + U.fmtFecha(dia(r.ultima)) : 'Sin hilo todavía') + '</small></div>';
      }).join('') + '</div>' : '<p class="vacio">Crea primero un cliente: cada cliente tiene su propio hilo de negociación.</p>');
  }

  // ---------- Hilo (chat) ----------
  async function abrir(clienteId) {
    if (!clientes.find(c => c.id === clienteId)) await cargarLista();
    actual = clientes.find(c => c.id === clienteId);
    if (!actual) throw new Error('Cliente no encontrado');
    const h = await U.sb.from('upbq_negociaciones').select('id').eq('cliente_id', clienteId).maybeSingle();
    if (h.error) throw h.error;
    hiloId = h.data ? h.data.id : null;
    const [m, q] = await Promise.all([
      hiloId ? U.sb.from('upbq_negociacion_mensajes').select('*').eq('negociacion_id', hiloId).order('fecha').order('created_at') : Promise.resolve({ data: [] }),
      U.sb.from('upbq_cotizaciones').select('id,equipo,fecha,estado').eq('cliente_id', clienteId).order('fecha', { ascending: false })
    ]);
    if (m.error) throw m.error;
    if (q.error) throw q.error;
    msgs = m.data; cots = q.data;
    const meses = mesesDe();
    if (!mes || !meses.includes(mes)) mes = meses[0] || null; // por defecto, el mes más reciente
    await renderChat();
  }
  function mesesDe() { return Array.from(new Set(msgs.map(m => mesDe(m.fecha)))).sort().reverse(); }

  async function firmar(visibles) {
    urls = {};
    const paths = visibles.filter(m => m.storage_path).map(m => m.storage_path);
    if (!paths.length) return;
    const { data, error } = await U.sb.storage.from(BUCKET).createSignedUrls(paths, 600); // URLs de vida corta
    if (error) throw error;
    (data || []).forEach(d => { if (d.signedUrl) urls[d.path] = d.signedUrl; });
  }
  function burbuja(m) {
    const cot = m.cotizacion_id ? cots.find(c => c.id === m.cotizacion_id) : null;
    const url = m.storage_path ? urls[m.storage_path] : '';
    let cuerpo = '';
    if (m.tipo === 'imagen') cuerpo += url ? '<img class="adj-img" src="' + esc(url) + '" alt="' + esc(m.nombre_archivo || 'imagen') + '" loading="lazy" data-action="neg.img" data-id="' + esc(m.id) + '">' : '<em>(imagen no disponible)</em>';
    if (m.tipo === 'pdf') cuerpo += '<div class="adj-pdf">📄 ' + esc(m.nombre_archivo || 'documento.pdf') + ' ' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">Ver</a> ' : '') +
      '<button class="btn mini-b" data-action="neg.pdf-dl" data-id="' + esc(m.id) + '">Descargar</button></div>';
    if (m.contenido) cuerpo += '<div class="txt">' + esc(m.contenido) + '</div>';
    return '<div class="bub ' + esc(m.emisor) + '">' +
      (cot ? '<span class="badge cotiz">Cotiz. ' + esc(cot.equipo || U.fmtFecha(cot.fecha)) + '</span>' : '') + cuerpo +
      '<div class="meta">' + esc(EMISOR[m.emisor]) + ' · ' + esc(hora(m.fecha)) + ' <button class="x" title="Eliminar" data-action="neg.del" data-id="' + esc(m.id) + '">✕</button></div></div>';
  }
  async function renderChat() {
    const visibles = mes ? msgs.filter(m => mesDe(m.fecha) === mes) : msgs;
    await firmar(visibles);
    const chips = ['<button class="chip' + (!mes ? ' on' : '') + '" data-action="neg.mes" data-id="">Todos (' + msgs.length + ')</button>']
      .concat(mesesDe().map(k => '<button class="chip' + (mes === k ? ' on' : '') + '" data-action="neg.mes" data-id="' + esc(k) + '">' + esc(etiquetaMes(k)) + ' (' + msgs.filter(m => mesDe(m.fecha) === k).length + ')</button>')).join('');
    let cuerpo = '', ult = '';
    visibles.forEach(m => {
      const d = dia(m.fecha);
      if (d !== ult) { cuerpo += '<div class="dia">' + esc(U.fmtFecha(d)) + '</div>'; ult = d; }
      cuerpo += burbuja(m);
    });
    document.getElementById('vista').innerHTML = '<div class="head"><div class="row"><button class="btn" data-action="neg.lista">←</button><h2>' + esc(actual.nombre) + '</h2></div>' +
      '<div class="row"><button class="btn primary" data-action="neg.nuevo">+ Mensaje</button><button class="btn" data-action="neg.imp">Importar</button></div></div>' +
      (msgs.length ? '<div class="chips">' + chips + '</div><div class="chat">' + (cuerpo || '<p class="vacio">Sin mensajes en este mes.</p>') + '</div>'
        : '<p class="vacio">Este hilo está vacío. Agrega un mensaje o importa una conversación de WhatsApp.</p>');
    const chat = document.querySelector('.chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  // ---------- Adjuntos ----------
  function extDe(nombre) { return (String(nombre).split('.').pop() || '').toLowerCase(); }
  async function comprimir(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
      return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
    } catch (e) { return file; }
  }
  function idUnico() { return (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  // Valida MIME/tamaño, comprime y sube. Devuelve { path, tipo, nombre }.
  async function subir(file) {
    if (!MIME_OK.includes(file.type)) throw new Error('“' + file.name + '”: solo se aceptan imágenes (JPG, PNG, WEBP, GIF) y PDF');
    file = await comprimir(file);
    if (file.size > MAX_BYTES) throw new Error('“' + file.name + '” supera 10 MB');
    const path = hiloId + '/' + idUnico() + '.' + (extDe(file.name) || 'bin');
    const { error } = await U.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error('No se pudo subir “' + file.name + '”: ' + error.message);
    return { path, tipo: file.type === 'application/pdf' ? 'pdf' : 'imagen', nombre: file.name };
  }
  async function asegurarHilo() {
    if (hiloId) return hiloId;
    const ins = await U.sb.from('upbq_negociaciones').insert({ cliente_id: actual.id }).select('id').single();
    if (ins.error) {
      const h = await U.sb.from('upbq_negociaciones').select('id').eq('cliente_id', actual.id).maybeSingle();
      if (h.error || !h.data) throw ins.error;
      hiloId = h.data.id;
    } else hiloId = ins.data.id;
    return hiloId;
  }

  // ---------- Mensaje manual ----------
  function ahoraLocal() { return U.today() + 'T' + hora(new Date().toISOString()); }
  function optsCots(sel) {
    return '<option value="">Sin cotización</option>' + cots.map(c => '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>' + esc((c.equipo || 'Cotización') + ' · ' + U.fmtFecha(c.fecha)) + '</option>').join('');
  }
  function formMensaje() {
    U.openModal('<h3>Nuevo mensaje · ' + esc(actual.nombre) + '</h3>' +
      '<label>Emisor<select id="nm-emisor">' + U.opts(EMISOR, 'cliente') + '</select></label>' +
      '<label>Fecha y hora (Bogotá)<input id="nm-fecha" type="datetime-local" value="' + esc(ahoraLocal()) + '"></label>' +
      '<label>Cotización relacionada<select id="nm-cot">' + optsCots('') + '</select></label>' +
      '<label>Texto<textarea id="nm-texto" rows="4"></textarea></label>' +
      '<label>Adjuntos (imágenes o PDF, máx. 10 MB c/u)<input id="nm-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"></label>' +
      '<div id="nm-prog" class="vacio"></div>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="neg.guardar">Guardar</button></div>');
  }
  async function guardarMensaje() {
    const v = k => document.getElementById(k).value;
    const texto = v('nm-texto').trim(), files = Array.from(document.getElementById('nm-files').files);
    if (!v('nm-fecha')) throw new Error('Indica fecha y hora');
    if (!texto && !files.length) throw new Error('Escribe un texto o adjunta un archivo');
    const base = Date.parse(v('nm-fecha') + ':00-05:00');
    if (isNaN(base)) throw new Error('Fecha inválida');
    const emisor = v('nm-emisor'), cot = v('nm-cot') || null, prog = document.getElementById('nm-prog');
    for (const f of files) if (!MIME_OK.includes(f.type)) throw new Error('“' + f.name + '”: solo imágenes (JPG, PNG, WEBP, GIF) y PDF');
    await asegurarHilo();
    const filas = [];
    let seq = 0;
    for (let i = 0; i < files.length; i++) {
      prog.textContent = 'Subiendo adjunto ' + (i + 1) + ' de ' + files.length + '…';
      const a = await subir(files[i]);
      filas.push({ negociacion_id: hiloId, cotizacion_id: cot, fecha: new Date(base + seq++).toISOString(), emisor, tipo: a.tipo, storage_path: a.path, nombre_archivo: a.nombre, origen: 'manual', hash: P.hash(['m', idUnico()].join('|')) });
    }
    if (texto) filas.push({ negociacion_id: hiloId, cotizacion_id: cot, fecha: new Date(base + seq++).toISOString(), emisor, tipo: 'texto', contenido: texto, origen: 'manual', hash: P.hash(['m', idUnico()].join('|')) });
    const { error } = await U.sb.from('upbq_negociacion_mensajes').insert(filas);
    if (error) throw error;
    U.dirty.panel = true;
    mes = mesDe(new Date(base).toISOString());
    U.toast('Mensaje guardado');
    U.closeModal();
    await abrir(actual.id);
  }
  async function eliminar(id) {
    const m = msgs.find(x => x.id === id);
    if (!m) return;
    if (!(await U.confirmar('¿Eliminar este mensaje' + (m.storage_path ? ' y su adjunto' : '') + '? No se puede deshacer.'))) return;
    if (m.storage_path) {
      const r = await U.sb.storage.from(BUCKET).remove([m.storage_path]);
      if (r.error) throw r.error;
    }
    const { error } = await U.sb.from('upbq_negociacion_mensajes').delete().eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast('Mensaje eliminado');
    await abrir(actual.id);
  }
  async function descargarPdf(id) {
    const m = msgs.find(x => x.id === id);
    const { data, error } = await U.sb.storage.from(BUCKET).createSignedUrl(m.storage_path, 120, { download: m.nombre_archivo || true });
    if (error) throw error;
    global.open(data.signedUrl, '_blank', 'noopener');
  }
  function lightbox(id) {
    const m = msgs.find(x => x.id === id), url = m && urls[m.storage_path];
    if (!url) return;
    U.openModal('<img class="lightbox" src="' + esc(url) + '" alt="' + esc(m.nombre_archivo || 'imagen') + '"><div class="row end"><button class="btn" data-action="modal.cerrar">Cerrar</button></div>');
  }

  // ---------- Importar (WhatsApp .txt / .zip / JSON) ----------
  function formImportar() {
    imp = null;
    U.openModal('<h3>Importar conversación · ' + esc(actual.nombre) + '</h3>' +
      '<p class="vacio">Todo se procesa en tu navegador; nada sale a terceros. En WhatsApp: chat → ⋮ → Más → Exportar chat (con o sin archivos).</p>' +
      '<label>Archivo (.txt o .zip de WhatsApp, o .json)<input id="imp-file" type="file" accept=".txt,.zip,.json,text/plain,application/zip,application/json"></label>' +
      '<label>…o pega el texto (WhatsApp o JSON)<textarea id="imp-texto" rows="5"></textarea></label>' +
      '<details><summary>Formato JSON</summary><pre class="code">{ "mensajes": [\n  { "fecha": "2026-09-01 10:30", "emisor": "cliente", "texto": "Hola…" },\n  { "fecha": "2026-09-01 10:41", "emisor": "nosotros", "texto": "…" }\n] }</pre></details>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="neg.imp-analizar">Analizar</button></div>');
  }
  function cargarJSZip() {
    if (global.JSZip) return Promise.resolve(global.JSZip);
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = JSZIP_URL;
      s.onload = () => res(global.JSZip);
      s.onerror = () => rej(new Error('No pude cargar el lector de .zip. Descomprime el archivo y sube el _chat.txt'));
      document.head.appendChild(s);
    });
  }
  async function analizar() {
    const file = document.getElementById('imp-file').files[0], pegado = document.getElementById('imp-texto').value;
    let parsed, zip = null;
    if (file) {
      const ext = extDe(file.name);
      if (ext === 'zip') {
        const JSZip = await cargarJSZip();
        zip = await JSZip.loadAsync(file);
        const txt = Object.keys(zip.files).filter(n => /\.txt$/i.test(n) && !/__MACOSX/.test(n) && !zip.files[n].dir).sort((a, b) => (/_chat\.txt$/i.test(b) ? 1 : 0) - (/_chat\.txt$/i.test(a) ? 1 : 0))[0];
        if (!txt) throw new Error('El .zip no contiene un archivo de chat (.txt)');
        parsed = P.parseWhatsApp(await zip.files[txt].async('string'));
      } else if (ext === 'json') parsed = P.parseJSON(await file.text());
      else parsed = P.parseWhatsApp(await file.text());
    } else if (pegado.trim()) {
      parsed = /^\s*[\[{]/.test(pegado) ? P.parseJSON(pegado) : P.parseWhatsApp(pegado);
    } else throw new Error('Sube un archivo o pega el texto de la conversación');
    imp = { parsed, zip };
    previa();
  }
  function bajoZip(zip, nombre) {
    if (!zip) return null;
    const objetivo = nombre.toLowerCase();
    const k = Object.keys(zip.files).find(n => !zip.files[n].dir && n.split('/').pop().toLowerCase() === objetivo);
    return k ? zip.files[k] : null;
  }
  function previa() {
    const { parsed, zip } = imp, ms = parsed.mensajes, wa = parsed.origen === 'whatsapp';
    const conAdj = ms.filter(m => m.adjunto), enZip = conAdj.filter(m => bajoZip(zip, m.adjunto));
    const omit = ms.filter(m => m.omitido).length;
    const remit = wa ? '<fieldset><legend>¿Quién eres tú? Marca los remitentes que son “Nosotros” (los demás serán el cliente)</legend>' +
      Object.keys(parsed.remitentes).map((n, i) => '<label class="chk"><input type="checkbox" class="imp-nos" value="' + esc(n) + '"> ' + esc(n) + ' (' + parsed.remitentes[n] + ')</label>').join('') + '</fieldset>' : '';
    U.openModal('<h3>Vista previa</h3><p><b>' + ms.length + '</b> mensajes' + (wa ? ' · formato ' + esc(parsed.formato) : '') + (conAdj.length ? ' · ' + conAdj.length + ' con adjunto (' + enZip.length + ' encontrados en el .zip)' : '') +
      (omit ? ' · ' + omit + ' adjuntos omitidos en el export' : '') + (parsed.ignoradas ? ' · ' + parsed.ignoradas + ' líneas de sistema ignoradas' : '') + '</p>' +
      remit + '<label>Vincular todos a una cotización (opcional)<select id="imp-cot">' + optsCots('') + '</select></label>' +
      '<div class="previa">' + ms.slice(0, 6).map(m => '<div class="mini"><span>' + esc(U.fmtFecha(dia(m.fecha))) + ' ' + esc(hora(m.fecha)) + ' · <b>' + esc(m.remitente || EMISOR[m.emisor]) + '</b>: ' + esc((m.texto || (m.adjunto ? '📎 ' + m.adjunto : '(adjunto omitido)')).slice(0, 90)) + '</span></div>').join('') +
      (ms.length > 6 ? '<small class="vacio">… y ' + (ms.length - 6) + ' más</small>' : '') + '</div>' +
      '<div id="imp-prog" class="vacio"></div>' +
      '<div class="row end"><button class="btn" data-action="neg.imp">Volver</button><button class="btn primary" data-action="neg.imp-run">Importar</button></div>');
  }
  async function importar() {
    const { parsed, zip } = imp, wa = parsed.origen === 'whatsapp';
    const nos = new Set(Array.from(document.querySelectorAll('.imp-nos:checked')).map(x => x.value));
    const cotEl = document.getElementById('imp-cot'), cotId = cotEl ? cotEl.value || null : null; // leer ANTES de confirmar (el modal se reemplaza)
    if (wa && !nos.size && !(await U.confirmar('No marcaste ningún remitente como “Nosotros”: todos los mensajes quedarán como del cliente. ¿Continuar?'))) return previa();
    U.openModal('<h3>Importando…</h3><div id="imp-prog" class="vacio">Preparando…</div>');
    const prog = () => document.getElementById('imp-prog');
    await asegurarHilo();
    const ex = await U.sb.from('upbq_negociacion_mensajes').select('hash').eq('negociacion_id', hiloId).limit(20000);
    if (ex.error) throw ex.error;
    const existentes = new Set(ex.data.map(x => x.hash));

    const filas = [], usados = {};
    let duplicados = 0, adjSubidos = 0, adjFallidos = 0;
    const fechaUnica = f => { usados[f] = (usados[f] || 0); return new Date(Date.parse(f) + usados[f]++).toISOString(); }; // conserva el orden dentro del mismo segundo
    const total = parsed.mensajes.filter(m => m.adjunto).length;
    for (const m of parsed.mensajes) {
      const emisor = wa ? (nos.has(m.remitente) ? 'nosotros' : 'cliente') : m.emisor;
      const origen = parsed.origen;
      if (m.adjunto) {
        const entrada = bajoZip(zip, m.adjunto), mime = MIME_EXT[extDe(m.adjunto)];
        const h = P.hash([m.fecha, emisor, 'adj', m.adjunto].join('|'));
        if (existentes.has(h)) duplicados++;
        else if (entrada && mime) {
          try {
            prog().textContent = 'Subiendo adjuntos ' + (adjSubidos + adjFallidos + 1) + ' de ' + total + '…';
            const blob = await entrada.async('blob');
            const a = await subir(new File([blob], m.adjunto.split('/').pop(), { type: mime }));
            filas.push({ negociacion_id: hiloId, cotizacion_id: cotId, fecha: fechaUnica(m.fecha), emisor, tipo: a.tipo, storage_path: a.path, nombre_archivo: a.nombre, origen, hash: h });
            adjSubidos++;
          } catch (e) { adjFallidos++; filas.push(filaTexto(m, emisor, origen, cotId, fechaUnica, '📎 ' + m.adjunto + ' (no se pudo subir: ' + e.message + ')', 'x' + h)); }
        } else filas.push(filaTexto(m, emisor, origen, cotId, fechaUnica, '📎 ' + m.adjunto + ' (archivo no incluido en la importación)', h));
      }
      if (m.omitido) { const h = P.hash([m.fecha, emisor, 'omit'].join('|')); if (existentes.has(h)) duplicados++; else filas.push(filaTexto(m, emisor, origen, cotId, fechaUnica, '📎 (adjunto omitido en el export)', h)); }
      if (m.texto) {
        const h = P.hash([m.fecha, emisor, 'texto', m.texto].join('|'));
        if (existentes.has(h)) duplicados++; else filas.push(filaTexto(m, emisor, origen, cotId, fechaUnica, m.texto, h));
      }
    }
    let n = 0;
    for (let i = 0; i < filas.length; i += 100) {
      prog().textContent = 'Guardando mensajes… ' + Math.min(i + 100, filas.length) + ' de ' + filas.length;
      const { error } = await U.sb.from('upbq_negociacion_mensajes').upsert(filas.slice(i, i + 100), { onConflict: 'negociacion_id,hash', ignoreDuplicates: true });
      if (error) throw error;
      n += Math.min(100, filas.length - i);
    }
    U.dirty.panel = true;
    U.toast('Importados ' + n + ' mensajes' + (adjSubidos ? ' · ' + adjSubidos + ' adjuntos' : '') + (duplicados ? ' · ' + duplicados + ' ya existían' : '') + (adjFallidos ? ' · ' + adjFallidos + ' adjuntos fallaron' : ''), adjFallidos ? 'err' : '');
    imp = null;
    U.closeModal();
    mes = null;
    await abrir(actual.id);
  }
  function filaTexto(m, emisor, origen, cotId, fechaUnica, contenido, hash) {
    return { negociacion_id: hiloId, cotizacion_id: cotId, fecha: fechaUnica(m.fecha), emisor, tipo: 'texto', contenido, origen, hash };
  }

  function handle(a, id) {
    switch (a) {
      case 'abrir': mes = null; return abrir(id);
      case 'lista': actual = null; hiloId = null; return renderLista();
      case 'mes': mes = id || null; return renderChat();
      case 'nuevo': return formMensaje();
      case 'guardar': return guardarMensaje();
      case 'del': return eliminar(id);
      case 'img': return lightbox(id);
      case 'pdf-dl': return descargarPdf(id);
      case 'imp': return formImportar();
      case 'imp-analizar': return analizar();
      case 'imp-run': return importar();
    }
  }
  async function render() { return actual ? abrir(actual.id) : renderLista(); }
  global.UPBQ.modulos.neg = { render, handle };
})(window);
