// rutas.js — armado del path de Storage. Lógica PURA (testeable) y una sola convención:
// {empresa_id}/{entrega_id}/{uuid}.{ext} (Manual 6). El primer segmento (empresa_id) es
// lo que valida la policy del bucket, así que NUNCA anteponer nada antes de él.
(function (global) {
  'use strict';

  function _uuid() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    // Fallback simple (no crypto-fuerte; suficiente para nombre de archivo único).
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // Path determinístico si se pasa uuid (para tests); aleatorio si no.
  function rutaArchivo(empresaId, entregaId, ext, uuid) {
    if (!empresaId || !entregaId) throw new Error('empresaId y entregaId son obligatorios');
    var e = String(ext || 'bin').replace(/^\./, '').toLowerCase();
    return String(empresaId) + '/' + String(entregaId) + '/' + (uuid || _uuid()) + '.' + e;
  }

  global.Rutas = { rutaArchivo: rutaArchivo };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.Rutas;
  }
})(typeof window !== 'undefined' ? window : globalThis);
