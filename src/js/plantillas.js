// plantillas.js — gestión de plantillas de checklist por tipo de equipo (admin/supervisor).
// La autorización real la hacen las RPCs (guardar_plantilla*, eliminar_plantilla_item);
// esta UI es solo comodidad. Escritura siempre por RPC.
(function (global) {
  'use strict';

  var Util = global.Util || {};
  var esc = Util.esc || function (x) { return x; };
  var toast = Util.toast || function () {};

  var _tplAbierta = null; // {id, tipo, nombre} de la plantilla cuyos ítems se editan

  // --- Listado de plantillas + alta ---
  async function abrir() {
    var tpls = await global.Supa.listarPlantillas();
    var filas = tpls.length
      ? tpls.map(function (t) {
          return '<li>' +
            '<strong>' + esc(t.tipo_equipo) + '</strong> — ' + esc(t.nombre) +
            (t.activo ? '' : ' <em>(inactiva)</em>') +
            ' <button type="button" data-action="editar-plantilla-items" data-id="' + esc(t.id) +
              '" data-tipo="' + esc(t.tipo_equipo) + '" data-nombre="' + esc(t.nombre) + '">Ítems</button>' +
            '</li>';
        }).join('')
      : '<li class="vacio">Sin plantillas todavía.</li>';

    Util.modal(
      '<h2>Plantillas de checklist</h2>' +
      '<ul class="checklist">' + filas + '</ul>' +
      '<h3>Nueva plantilla</h3>' +
      '<label>Tipo de equipo <input id="f-tpl-tipo" type="text" placeholder="p. ej. retroexcavadora"></label>' +
      '<label>Nombre <input id="f-tpl-nombre" type="text" placeholder="Checklist retro"></label>' +
      '<div class="modal-acciones">' +
        '<button type="button" data-action="cerrar-modal">Cerrar</button>' +
        '<button type="button" class="btn-primario" data-action="crear-plantilla">Crear plantilla</button>' +
      '</div>'
    );
  }

  async function crear() {
    var tipo = (document.getElementById('f-tpl-tipo') || {}).value;
    var nombre = (document.getElementById('f-tpl-nombre') || {}).value;
    if (!tipo || !tipo.trim() || !nombre || !nombre.trim()) {
      toast('Tipo y nombre son obligatorios', 'error'); return;
    }
    await global.Supa.rpc('guardar_plantilla', {
      p_template_id: null, p_tipo_equipo: tipo.trim(), p_nombre: nombre.trim(), p_activo: true
    });
    toast('Plantilla creada', 'ok');
    await abrir();
  }

  // --- Ítems de una plantilla ---
  async function abrirItems(id, tipo, nombre) {
    _tplAbierta = { id: id, tipo: tipo, nombre: nombre };
    await _renderItems();
  }

  async function _renderItems() {
    if (!_tplAbierta) return;
    var items = await global.Supa.listarPlantillaItems(_tplAbierta.id);
    var filas = items.length
      ? items.map(function (it) {
          return '<li>' + esc(it.titulo) +
            (it.obligatorio ? ' <em>(oblig.)</em>' : '') +
            (it.foto_obligatoria ? ' 📷' : '') +
            ' <button type="button" data-action="eliminar-plantilla-item" data-id="' + esc(it.id) + '">✕</button>' +
            '</li>';
        }).join('')
      : '<li class="vacio">Sin ítems.</li>';

    Util.modal(
      '<h2>Ítems — ' + esc(_tplAbierta.tipo) + '</h2>' +
      '<p>' + esc(_tplAbierta.nombre) + '</p>' +
      '<ul class="checklist">' + filas + '</ul>' +
      '<div class="agregar-item">' +
        '<input id="f-pit-titulo" type="text" placeholder="Nuevo ítem">' +
        '<label><input id="f-pit-oblig" type="checkbox" checked> obligatorio</label>' +
        '<label><input id="f-pit-foto" type="checkbox"> foto obligatoria</label>' +
        '<button type="button" data-action="agregar-plantilla-item">Agregar</button>' +
      '</div>' +
      '<div class="modal-acciones">' +
        '<button type="button" data-action="volver-plantillas">← Plantillas</button>' +
        '<button type="button" data-action="cerrar-modal">Cerrar</button>' +
      '</div>'
    );
  }

  async function agregarItem() {
    if (!_tplAbierta) return;
    var titulo = (document.getElementById('f-pit-titulo') || {}).value;
    if (!titulo || !titulo.trim()) { toast('Escribe el título del ítem', 'error'); return; }
    await global.Supa.rpc('guardar_plantilla_item', {
      p_template_id: _tplAbierta.id, p_item_id: null, p_titulo: titulo.trim(),
      p_obligatorio: (document.getElementById('f-pit-oblig') || {}).checked,
      p_foto_obligatoria: (document.getElementById('f-pit-foto') || {}).checked,
      p_orden: 0
    });
    await _renderItems();
  }

  async function eliminarItem(itemId) {
    await global.Supa.rpc('eliminar_plantilla_item', { p_item_id: itemId });
    await _renderItems();
  }

  global.Plantillas = {
    abrir: abrir,
    crear: crear,
    abrirItems: abrirItems,
    agregarItem: agregarItem,
    eliminarItem: eliminarItem
  };
})(window);
