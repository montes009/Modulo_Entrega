'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Rutas = require('../src/js/rutas.js');

test('rutaArchivo arma {empresa}/{entrega}/{uuid}.{ext} con empresa como primer segmento', () => {
  const p = Rutas.rutaArchivo('EMP', 'ENT', 'jpg', 'UID');
  assert.strictEqual(p, 'EMP/ENT/UID.jpg');
  // el primer segmento (lo que valida la policy del bucket) es la empresa
  assert.strictEqual(p.split('/')[0], 'EMP');
});

test('normaliza la extensión (sin punto, minúsculas) y default', () => {
  assert.strictEqual(Rutas.rutaArchivo('e', 'x', '.PNG', 'u'), 'e/x/u.png');
  assert.strictEqual(Rutas.rutaArchivo('e', 'x', undefined, 'u'), 'e/x/u.bin');
});

test('exige empresa y entrega', () => {
  assert.throws(() => Rutas.rutaArchivo(null, 'x', 'jpg'));
  assert.throws(() => Rutas.rutaArchivo('e', null, 'jpg'));
});

test('genera uuid cuando no se pasa (paths distintos)', () => {
  const a = Rutas.rutaArchivo('e', 'x', 'jpg');
  const b = Rutas.rutaArchivo('e', 'x', 'jpg');
  assert.notStrictEqual(a, b);
});
