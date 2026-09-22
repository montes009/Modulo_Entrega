// entregas.js — módulo de dominio de Entregas de Equipo (IIFE + global).
// Coordina el flujo crear → checklist → firmas → PDF hablando con Supabase vía RPCs.
// Toda escritura sensible pasa por RPC SECURITY DEFINER (ver CLAUDE.md > Seguridad).
(function (global) {
  'use strict';

  var Util = global.Util || {};
  var esc = Util.esc || function (x) { return x; };
  var toast = Util.toast || function () {};
  var Estados = global.Estados || {};
  var Rutas = global.Rutas || {};
  var Firma = global.Firma || {};

  // Estado privado (const de scope: NO es propiedad de window).
  var _entregas = [];
  var _empresaId = null;
  var _rol = null;
  var _abierta = null; // id de la entrega abierta en el modal de detalle

  // --- Sesión / aislamiento por empresa ---
  function setSesion(membresia) {
    _empresaId = membresia ? membresia.empresa_id : null;
    _rol = membresia ? membresia.rol : null;
  }
  function limpiarEstado() {
    _entregas = []; _empresaId = null; _rol = null; _abierta = null;
  }
  function _deEmpresaActual(lista) {
    if (!_empresaId) return [];
    return (lista || []).filter(function (e) { return e && e.empresa_id === _empresaId; });
  }
  function puedeAnular() { return _rol === 'admin' || _rol === 'supervisor'; }

  // --- Carga y render de la lista ---
  async function cargar() {
    _entregas = await global.Supa.listarEntregas();
    renderLista();
  }

  function renderLista() {
    var cont = document.getElementById('lista-entregas');
    if (!cont) return;
    var visibles = _deEmpresaActual(_entregas); // filtro en el punto de pintado (Manual 9.2)
    if (visibles.length === 0) {
      cont.innerHTML = '<p class="vacio">Sin entregas todavía.</p>';
      return;
    }
    cont.innerHTML = visibles.map(function (e) {
      return '<article class="entrega" data-id="' + esc(e.id) + '">' +
        '<h3>' + esc(e.cliente_nombre) + '</h3>' +
        '<p>Equipo: ' + esc(e.equipo_id) + '</p>' +
        '<span class="estado estado-' + esc(e.estado) + '">' + esc(e.estado) + '</span> ' +
        '<button type="button" data-action="ver-entrega" data-id="' + esc(e.id) + '">Ver</button>' +
        '</article>';
    }).join('');
  }

  // --- Crear entrega ---
  function nueva() {
    Util.modal(
      '<h2>Nueva entrega</h2>' +
      '<label>Equipo (ID) <input id="f-equipo" type="text"></label>' +
      '<label>Cliente <input id="f-cliente" type="text"></label>' +
      '<label>Cédula cliente <input id="f-cedula" type="text"></label>' +
      '<label>Recibe (nombre) <input id="f-recibe" type="text"></label>' +
      '<label>Observaciones <textarea id="f-obs"></textarea></label>' +
      '<div class="modal-acciones">' +
        '<button type="button" data-action="cerrar-modal">Cancelar</button>' +
        '<button type="button" class="btn-primario" data-action="crear-entrega">Crear</button>' +
      '</div>'
    );
  }

  async function crearEntrega() {
    var val = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    var id = await global.Supa.rpc('crear_entrega_equipo', {
      p_equipo_id: val('f-equipo'),
      p_cliente_nombre: val('f-cliente'),
      p_recibido_por: val('f-recibe'),
      p_cliente_cedula: val('f-cedula') || null,
      p_observaciones: val('f-obs') || null
    });
    toast('Entrega creada', 'ok');
    await cargar();
    await abrir(id);
  }

  // --- Detalle ---
  async function abrir(id) {
    _abierta = id;
    var det = await global.Supa.detalleEntrega(id);
    if (!det) { toast('Entrega no encontrada', 'error'); return; }
    var items = await global.Supa.listarChecklist(id);
    var firmas = await global.Supa.listarFirmas(id);
    _renderDetalle(det, items, firmas);
  }

  // Re-pinta SIEMPRE el modal de detalle tras una acción (Manual 4.3).
  async function _refrescarDetalle() {
    if (_abierta) await abrir(_abierta);
  }

  function _renderDetalle(det, items, firmas) {
    var editable = det.estado === 'borrador';
    var enProceso = det.estado === 'en_proceso';
    var firmada = det.estado === 'firmada';

    var itemsHtml = items.length === 0
      ? '<p class="vacio">Checklist vacío.</p>'
      : items.map(function (it) {
          var opciones = ['ok', 'observacion', 'no_aplica'].map(function (r) {
            var sel = it.respuesta === r ? ' selected' : '';
            return '<option value="' + r + '"' + sel + '>' + r + '</option>';
          }).join('');
          return '<li data-item="' + esc(it.id) + '">' +
            '<strong>' + esc(it.titulo) + '</strong>' +
            (it.obligatorio ? ' <em>(obligatorio)</em>' : '') +
            (it.foto_obligatoria ? ' 📷' : '') +
            (editable
              ? ' <select data-action="responder-item" data-item="' + esc(it.id) + '">' +
                  '<option value="">—</option>' + opciones + '</select>' +
                (it.foto_obligatoria
                  ? ' <input type="file" accept="image/*" data-action="foto-item" data-item="' + esc(it.id) + '">'
                  : '')
              : ' → ' + esc(it.respuesta || 'sin responder')) +
            '</li>';
        }).join('');

    var firmasHtml = ['entrega', 'recibe'].map(function (rol) {
      var f = firmas.filter(function (x) { return x.rol === rol; })[0];
      return '<li>' + rol + ': ' + (f ? '✅ ' + esc(f.nombre) : '⬜ pendiente') +
        (enProceso && !f
          ? ' <button type="button" data-action="firmar" data-rol="' + rol + '">Firmar</button>'
          : '') + '</li>';
    }).join('');

    Util.modal(
      '<h2>Acta ' + esc(det.equipo_id) + ' — ' + esc(det.cliente_nombre) + '</h2>' +
      '<p>Estado: <span class="estado estado-' + esc(det.estado) + '">' + esc(det.estado) + '</span></p>' +
      '<h3>Checklist</h3><ul class="checklist">' + itemsHtml + '</ul>' +
      (editable
        ? '<div class="agregar-item">' +
            '<input id="f-item-titulo" type="text" placeholder="Nuevo ítem">' +
            '<label><input id="f-item-oblig" type="checkbox" checked> obligatorio</label>' +
            '<label><input id="f-item-foto" type="checkbox"> foto obligatoria</label>' +
            '<button type="button" data-action="agregar-item">Agregar</button>' +
          '</div>' +
          '<button type="button" class="btn-primario" data-action="cerrar-checklist">Cerrar checklist</button>'
        : '') +
      '<h3>Firmas</h3><ul>' + firmasHtml + '</ul>' +
      '<div class="modal-acciones">' +
        (firmada ? '<button type="button" data-action="imprimir-acta" data-id="' + esc(det.id) + '">Imprimir acta</button>' : '') +
        (det.estado !== 'anulada' && puedeAnular()
          ? '<button type="button" data-action="anular" data-id="' + esc(det.id) + '">Anular</button>' : '') +
        '<button type="button" data-action="cerrar-modal">Cerrar</button>' +
      '</div>'
    );
  }

  // --- Acciones del checklist ---
  async function agregarItem() {
    var titulo = (document.getElementById('f-item-titulo') || {}).value;
    if (!titulo || !titulo.trim()) { toast('Escribe el título del ítem', 'error'); return; }
    var oblig = (document.getElementById('f-item-oblig') || {}).checked;
    var foto = (document.getElementById('f-item-foto') || {}).checked;
    await global.Supa.rpc('guardar_checklist_item', {
      p_entrega_id: _abierta, p_item_id: null, p_titulo: titulo.trim(),
      p_respuesta: null, p_observacion: null,
      p_obligatorio: !!oblig, p_foto_obligatoria: !!foto
    });
    await _refrescarDetalle();
  }

  async function responderItem(itemId, respuesta) {
    await global.Supa.rpc('guardar_checklist_item', {
      p_entrega_id: _abierta, p_item_id: itemId, p_titulo: null,
      p_respuesta: respuesta || null, p_observacion: null
    });
    await _refrescarDetalle();
  }

  async function subirFotoItem(itemId, file) {
    if (!file) return;
    var path = Rutas.rutaArchivo(_empresaId, _abierta, (file.name.split('.').pop() || 'jpg'));
    await global.Supa.subir(path, file, file.type || 'image/jpeg');
    await global.Supa.rpc('registrar_foto', {
      p_entrega_id: _abierta, p_storage_path: path, p_item_id: itemId
    });
    toast('Foto subida', 'ok');
    await _refrescarDetalle();
  }

  async function cerrarChecklist() {
    await global.Supa.rpc('cerrar_checklist', { p_entrega_id: _abierta });
    toast('Checklist cerrado', 'ok');
    await cargar();
    await _refrescarDetalle();
  }

  // --- Firma ---
  function abrirFirma(rol) {
    var m = Util.modal(
      '<h2>Firma de quien ' + esc(rol === 'entrega' ? 'entrega' : 'recibe') + '</h2>' +
      '<label>Nombre <input id="f-firma-nombre" type="text"></label>' +
      '<label>Documento <input id="f-firma-doc" type="text"></label>' +
      '<canvas id="f-firma-canvas" width="320" height="120" class="canvas-firma"></canvas>' +
      '<div class="modal-acciones">' +
        '<button type="button" data-action="limpiar-firma">Limpiar</button>' +
        '<button type="button" data-action="cerrar-modal">Cancelar</button>' +
        '<button type="button" class="btn-primario" data-action="guardar-firma" data-rol="' + esc(rol) + '">Guardar firma</button>' +
      '</div>'
    );
    var canvas = m && m.querySelector('#f-firma-canvas');
    if (canvas && Firma.bindCanvas) { global.__firmaCtrl = Firma.bindCanvas(canvas); }
  }

  async function guardarFirma(rol) {
    var ctrl = global.__firmaCtrl;
    var canvas = document.getElementById('f-firma-canvas');
    var nombre = (document.getElementById('f-firma-nombre') || {}).value;
    if (!nombre || !nombre.trim()) { toast('Falta el nombre', 'error'); return; }
    if (!canvas || (ctrl && ctrl.estaVacio())) { toast('La firma está vacía', 'error'); return; }

    var det = await global.Supa.detalleEntrega(_abierta);
    var items = await global.Supa.listarChecklist(_abierta);
    var hash = await _hashActa(det, items);

    var blob = await Firma.exportarPNG(canvas);
    var path = Rutas.rutaArchivo(_empresaId, _abierta, 'png');
    await global.Supa.subir(path, blob, 'image/png');

    var nuevo = await global.Supa.rpc('registrar_firma', {
      p_entrega_id: _abierta, p_rol: rol, p_nombre: nombre.trim(),
      p_storage_path: path, p_acta_hash: hash,
      p_documento: (document.getElementById('f-firma-doc') || {}).value || null
    });
    if (ctrl && ctrl.desmontar) ctrl.desmontar();
    toast(nuevo === 'firmada' ? 'Acta firmada' : 'Firma registrada', 'ok');
    await cargar();
    await _refrescarDetalle();
  }

  // Hash de integridad del acta (SHA-256 hex de un snapshot de los campos clave).
  async function _hashActa(det, items) {
    var snap = JSON.stringify({
      id: det.id, equipo: det.equipo_id, cliente: det.cliente_nombre,
      recibe: det.recibido_por,
      items: items.map(function (i) { return [i.id, i.respuesta, i.observacion]; })
    });
    if (global.crypto && global.crypto.subtle) {
      var buf = await global.crypto.subtle.digest('SHA-256', new TextEncoder().encode(snap));
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
    }
    return 'nohash-' + snap.length; // fallback (entornos sin SubtleCrypto)
  }

  // --- Anular ---
  function anular(id) {
    Util.modal(
      '<h2>Anular entrega</h2>' +
      '<p>El acta no se borra: se anula (con motivo) y se rehace.</p>' +
      '<label>Motivo <textarea id="f-motivo"></textarea></label>' +
      '<div class="modal-acciones">' +
        '<button type="button" data-action="cerrar-modal">Cancelar</button>' +
        '<button type="button" class="btn-primario" data-action="confirmar-anular" data-id="' + esc(id) + '">Anular</button>' +
      '</div>'
    );
  }
  async function confirmarAnular(id) {
    var motivo = (document.getElementById('f-motivo') || {}).value;
    if (!motivo || !motivo.trim()) { toast('El motivo es obligatorio', 'error'); return; }
    await global.Supa.rpc('anular_entrega', { p_entrega_id: id, p_motivo: motivo.trim() });
    toast('Entrega anulada', 'ok');
    await cargar();
    _abierta = id;
    await _refrescarDetalle();
  }

  // --- PDF ---
  function imprimir(id) {
    if (!id) return;
    global.open('print/print_acta.html?id=' + encodeURIComponent(id), '_blank');
  }

  global.EntregasEquipo = {
    setSesion: setSesion,
    limpiarEstado: limpiarEstado,
    cargar: cargar,
    renderLista: renderLista,
    nueva: nueva,
    crearEntrega: crearEntrega,
    abrir: abrir,
    agregarItem: agregarItem,
    responderItem: responderItem,
    subirFotoItem: subirFotoItem,
    cerrarChecklist: cerrarChecklist,
    abrirFirma: abrirFirma,
    guardarFirma: guardarFirma,
    anular: anular,
    confirmarAnular: confirmarAnular,
    imprimir: imprimir
  };
})(window);
