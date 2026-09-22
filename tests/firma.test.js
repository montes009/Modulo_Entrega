'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Firma = require('../src/js/firma.js');

const base = { nombre: 'Juan', storage_path: 'e/a/f.png', acta_hash: 'abc', rol: 'entrega' };

test('firma válida no reporta errores', () => {
  assert.deepStrictEqual(Firma.validarPayloadFirma(base), []);
  assert.strictEqual(Firma.firmaEsValida(base), true);
});

test('detecta campos faltantes', () => {
  assert.ok(Firma.validarPayloadFirma(Object.assign({}, base, { nombre: '' })).length > 0);
  assert.ok(Firma.validarPayloadFirma(Object.assign({}, base, { storage_path: '' })).length > 0);
  assert.ok(Firma.validarPayloadFirma(Object.assign({}, base, { acta_hash: '' })).length > 0);
  assert.ok(Firma.validarPayloadFirma(Object.assign({}, base, { rol: 'otro' })).length > 0);
  assert.ok(Firma.validarPayloadFirma(null).length > 0);
});
