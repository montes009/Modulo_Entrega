// checklist.js — lógica pura del checklist de una entrega.
// Se mantiene SIN dependencias del DOM para poder testearla con node:test cargando
// este mismo archivo real (ver CLAUDE.md > Tests / harness sandbox).
(function (global) {
  'use strict';

  // Respuestas válidas de un ítem.
  var RESPUESTAS = { OK: 'ok', OBSERVACION: 'observacion', NO_APLICA: 'no_aplica' };

  // Un ítem está respondido si tiene una respuesta válida.
  function itemRespondido(item) {
    return !!item && Object.keys(RESPUESTAS).some(function (k) {
      return item.respuesta === RESPUESTAS[k];
    });
  }

  // Un ítem cumple su requisito de foto si no la exige, o si tiene al menos una.
  function itemCumpleFoto(item) {
    if (!item || !item.foto_obligatoria) return true;
    return Array.isArray(item.fotos) && item.fotos.length > 0;
  }

  // ¿El checklist está completo para poder cerrar (pasar a en_proceso)?
  // Todos los ítems obligatorios respondidos y con foto si la exigen.
  function estaCompleto(items) {
    if (!Array.isArray(items) || items.length === 0) return false;
    return items.every(function (item) {
      if (item && item.obligatorio === false) return true;
      return itemRespondido(item) && itemCumpleFoto(item);
    });
  }

  // Lista de ítems que impiden cerrar el checklist (para mostrar al usuario).
  function itemsFaltantes(items) {
    if (!Array.isArray(items)) return [];
    return items.filter(function (item) {
      if (item && item.obligatorio === false) return false;
      return !itemRespondido(item) || !itemCumpleFoto(item);
    });
  }

  global.Checklist = {
    RESPUESTAS: RESPUESTAS,
    itemRespondido: itemRespondido,
    itemCumpleFoto: itemCumpleFoto,
    estaCompleto: estaCompleto,
    itemsFaltantes: itemsFaltantes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.Checklist;
  }
})(typeof window !== 'undefined' ? window : globalThis);
