'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Estados = require('../src/js/estados.js');

test('transiciones válidas del acta', () => {
  assert.ok(Estados.puedeTransicionar('borrador', 'en_proceso'));
  assert.ok(Estados.puedeTransicionar('en_proceso', 'firmada'));
  assert.ok(Estados.puedeTransicionar('firmada', 'anulada'));
});

test('transiciones inválidas se rechazan', () => {
  assert.strictEqual(Estados.puedeTransicionar('borrador', 'firmada'), false);
  assert.strictEqual(Estados.puedeTransicionar('firmada', 'en_proceso'), false);
  assert.strictEqual(Estados.puedeTransicionar('anulada', 'borrador'), false);
});

test('estados finales', () => {
  assert.ok(Estados.esFinal('firmada'));
  assert.ok(Estados.esFinal('anulada'));
  assert.strictEqual(Estados.esFinal('borrador'), false);
});
