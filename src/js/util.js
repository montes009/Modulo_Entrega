// util.js — utilidades compartidas de todo el repo.
// Convención ÚNICA de escape (ver CLAUDE.md): siempre `esc()`. No crear variantes.
(function (global) {
  'use strict';

  // Escapa texto libre antes de interpolarlo en innerHTML. XSS-safe.
  function esc(v) {
    if (v == null) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Notificación in-app (nunca alert() nativo).
  function toast(mensaje, tipo) {
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + (tipo || 'info');
    el.textContent = mensaje; // textContent = ya escapado por el DOM
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 4000);
  }

  // Envuelve un handler para convertir fallos silenciosos ('use strict') en un toast
  // accionable con el mensaje exacto del error (ver CLAUDE.md > Convenciones de JS).
  function guard(fn) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        toast('Error: ' + (e && e.message ? e.message : e), 'error');
        throw e;
      }
    };
  }

  // Modal in-app (nunca confirm()/alert() nativos). `innerHtml` lo construye el llamador,
  // que DEBE haber escapado con esc() cualquier texto libre interpolado.
  function modal(innerHtml) {
    var root = document.getElementById('modal-root');
    if (!root) return null;
    root.innerHTML =
      '<div class="modal-backdrop" data-action="cerrar-modal"></div>' +
      '<div class="modal" role="dialog" aria-modal="true">' + innerHtml + '</div>';
    root.style.display = 'block';
    return root.querySelector('.modal');
  }

  function cerrarModal() {
    var root = document.getElementById('modal-root');
    if (!root) return;
    root.innerHTML = '';
    root.style.display = 'none';
  }

  global.Util = {
    esc: esc, toast: toast, guard: guard, modal: modal, cerrarModal: cerrarModal
  };
})(window);
