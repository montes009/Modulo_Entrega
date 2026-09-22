// entregas.js — módulo de dominio de Entregas de Equipo.
// Coordina el flujo (crear → checklist → firmas → PDF) y habla con Supabase vía RPCs.
// Toda operación sensible pasa por una RPC SECURITY DEFINER (ver CLAUDE.md > Seguridad).
(function (global) {
  'use strict';

  var Util = global.Util || {};
  var esc = Util.esc || function (x) { return x; };

  // Estado privado del módulo (NO es propiedad de window: es const de scope).
  var _entregas = [];
  var _empresaId = null; // se setea en login; se limpia en logout

  // --- Filtro de aislamiento por empresa (última línea de defensa, ver CLAUDE.md 9.2) ---
  function _deEmpresaActual(lista) {
    if (!_empresaId) return [];
    return (lista || []).filter(function (e) { return e && e.empresa_id === _empresaId; });
  }

  function setEmpresa(id) { _empresaId = id || null; }

  function limpiarEstado() {
    _entregas = [];
    _empresaId = null;
  }

  // Render del listado. Filtra por empresa en el punto de pintado, siempre.
  function renderLista() {
    var cont = document.getElementById('lista-entregas');
    if (!cont) return;
    var visibles = _deEmpresaActual(_entregas);
    if (visibles.length === 0) {
      cont.innerHTML = '<p class="vacio">Sin entregas todavía.</p>';
      return;
    }
    cont.innerHTML = visibles.map(function (e) {
      return '<article class="entrega" data-id="' + esc(e.id) + '">' +
        '<h3>' + esc(e.cliente_nombre) + '</h3>' +
        '<p>Equipo: ' + esc(e.equipo_id) + '</p>' +
        '<span class="estado estado-' + esc(e.estado) + '">' + esc(e.estado) + '</span>' +
        '<button type="button" data-action="ver-entrega" data-id="' + esc(e.id) + '">Ver</button>' +
        '</article>';
    }).join('');
  }

  // --- Acciones (todas invocadas por el listener delegado de app.js) ---

  function abrir(id) {
    // TODO: cargar detalle desde Supabase (columnas explícitas, nunca select('*'))
    //       y pintar el modal de detalle.
  }

  function nueva() {
    // TODO: modal de creación → selecciona equipo + cliente → RPC crear_entrega_equipo.
  }

  function guardar() {
    // TODO: guardado incremental del checklist (no perder si se cierra la pestaña).
  }

  function imprimir(id) {
    // El PDF se arma desde los datos YA persistidos, nunca desde memoria (ver Manual 8).
    if (!id) return;
    global.open('print/print_acta.html?id=' + encodeURIComponent(id), '_blank');
  }

  // Exposición explícita de lo que otros módulos / app.js necesitan.
  global.EntregasEquipo = {
    setEmpresa: setEmpresa,
    limpiarEstado: limpiarEstado,
    renderLista: renderLista,
    abrir: abrir,
    nueva: nueva,
    guardar: guardar,
    imprimir: imprimir
  };
})(window);
