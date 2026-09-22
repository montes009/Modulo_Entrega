// estados.js — fuente ÚNICA de verdad del vocabulario de estados del acta de entrega.
// Debe mantenerse sincronizada con el CHECK de la BD (supabase/migrations). Nunca
// duplicar esta lista en otro archivo (ver CLAUDE.md > Modelo único de estados).
(function (global) {
  'use strict';

  var ESTADOS = {
    BORRADOR: 'borrador',
    EN_PROCESO: 'en_proceso',
    FIRMADA: 'firmada',
    ANULADA: 'anulada'
  };

  // Transiciones permitidas (la RPC del servidor es la que las hace cumplir de verdad;
  // esto es solo la primera línea de defensa en el cliente).
  var TRANSICIONES = {
    borrador: ['en_proceso', 'anulada'],
    en_proceso: ['firmada', 'anulada'],
    firmada: ['anulada'], // un acta firmada es inmutable: solo se puede anular
    anulada: []
  };

  function puedeTransicionar(desde, hacia) {
    return (TRANSICIONES[desde] || []).indexOf(hacia) !== -1;
  }

  function esFinal(estado) {
    return estado === ESTADOS.FIRMADA || estado === ESTADOS.ANULADA;
  }

  global.Estados = {
    ESTADOS: ESTADOS,
    TRANSICIONES: TRANSICIONES,
    puedeTransicionar: puedeTransicionar,
    esFinal: esFinal
  };

  // Puente para el harness de tests (node:test) que carga este archivo real.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.Estados;
  }
})(typeof window !== 'undefined' ? window : globalThis);
