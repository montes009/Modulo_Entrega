// firma.js — captura de firma en <canvas> y armado del payload de firma.
// La escritura real va SIEMPRE por la RPC registrar_firma (INSERT directo revocado).
(function (global) {
  'use strict';

  // Valida que el payload de firma esté listo antes de mandarlo a la RPC.
  // Lógica pura (testeable): no toca el DOM ni la red.
  function validarPayloadFirma(p) {
    var errores = [];
    if (!p || typeof p !== 'object') return ['payload vacío'];
    if (!p.nombre || !String(p.nombre).trim()) errores.push('falta nombre');
    if (!p.storage_path || !String(p.storage_path).trim()) errores.push('falta imagen de firma');
    if (!p.acta_hash || !String(p.acta_hash).trim()) errores.push('falta hash del acta');
    if (p.rol !== 'entrega' && p.rol !== 'recibe') errores.push('rol de firma inválido');
    return errores;
  }

  function firmaEsValida(p) {
    return validarPayloadFirma(p).length === 0;
  }

  // Exporta el trazo del canvas a un Blob PNG (para subir al bucket privado).
  // Solo en navegador.
  function exportarPNG(canvas) {
    return new Promise(function (resolve, reject) {
      if (!canvas || typeof canvas.toBlob !== 'function') {
        reject(new Error('canvas inválido'));
        return;
      }
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('no se pudo exportar la firma'));
      }, 'image/png');
    });
  }

  // Enlaza el dibujo a un <canvas> (pointer events). Devuelve un control con
  // { estaVacio, limpiar, desmontar }. Solo navegador.
  function bindCanvas(canvas) {
    var ctx = canvas.getContext('2d');
    var dibujando = false, vacio = true;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';

    function pos(ev) {
      var r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    }
    function abajo(ev) { dibujando = true; var p = pos(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); ev.preventDefault(); }
    function mover(ev) { if (!dibujando) return; var p = pos(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); vacio = false; ev.preventDefault(); }
    function arriba() { dibujando = false; }

    canvas.addEventListener('pointerdown', abajo);
    canvas.addEventListener('pointermove', mover);
    canvas.addEventListener('pointerup', arriba);
    canvas.addEventListener('pointerleave', arriba);

    return {
      estaVacio: function () { return vacio; },
      limpiar: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); vacio = true; },
      desmontar: function () {
        canvas.removeEventListener('pointerdown', abajo);
        canvas.removeEventListener('pointermove', mover);
        canvas.removeEventListener('pointerup', arriba);
        canvas.removeEventListener('pointerleave', arriba);
      }
    };
  }

  global.Firma = {
    validarPayloadFirma: validarPayloadFirma,
    firmaEsValida: firmaEsValida,
    exportarPNG: exportarPNG,
    bindCanvas: bindCanvas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.Firma;
  }
})(typeof window !== 'undefined' ? window : globalThis);
