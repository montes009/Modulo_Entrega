// app.js — arranque de la app y ÚNICO listener delegado de acciones.
// Todas las acciones se declaran con data-action="..." data-id="..." en el HTML;
// aquí se enrutan con un switch (ver CLAUDE.md > Convención de botones y acciones).
(function (global) {
  'use strict';

  var Util = global.Util || {};
  var guard = Util.guard || function (fn) { return fn; };

  function enrutarAccion(accion, id, el) {
    var E = global.EntregasEquipo || {};
    switch (accion) {
      case 'nueva-entrega':
        if (typeof E.nueva === 'function') E.nueva();
        break;
      case 'ver-entrega':
        if (typeof E.abrir === 'function') E.abrir(id);
        break;
      case 'imprimir-acta':
        if (typeof E.imprimir === 'function') E.imprimir(id);
        break;
      default:
        Util.toast && Util.toast('Acción no reconocida: ' + accion, 'error');
    }
  }

  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    enrutarAccion(el.getAttribute('data-action'), el.getAttribute('data-id'), el);
  }

  function init() {
    document.addEventListener('click', guard(onClick));
    // TODO: autenticar, resolver empresa_id (EntregasEquipo.setEmpresa) y cargar datos.
    var E = global.EntregasEquipo;
    if (E && typeof E.renderLista === 'function') E.renderLista();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
