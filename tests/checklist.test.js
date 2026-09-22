// Tests de lógica pura del checklist. Cargan el .js REAL del frontend (no una
// reimplementación) para que el test falle cuando cambie el código de producción
// (ver CLAUDE.md > Tests / harness sandbox).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const Checklist = require('../src/js/checklist.js');

const okItem = (over) => Object.assign({ obligatorio: true, respuesta: 'ok' }, over);

test('item respondido reconoce respuestas válidas', () => {
  assert.strictEqual(Checklist.itemRespondido({ respuesta: 'ok' }), true);
  assert.strictEqual(Checklist.itemRespondido({ respuesta: 'observacion' }), true);
  assert.strictEqual(Checklist.itemRespondido({ respuesta: 'no_aplica' }), true);
  assert.strictEqual(Checklist.itemRespondido({ respuesta: 'xxx' }), false);
  assert.strictEqual(Checklist.itemRespondido({}), false);
});

test('foto obligatoria: exige al menos una foto', () => {
  assert.strictEqual(Checklist.itemCumpleFoto(okItem({ foto_obligatoria: true, fotos: [] })), false);
  assert.strictEqual(Checklist.itemCumpleFoto(okItem({ foto_obligatoria: true, fotos: ['a'] })), true);
  assert.strictEqual(Checklist.itemCumpleFoto(okItem({ foto_obligatoria: false })), true);
});

test('checklist completo solo si todos los obligatorios cumplen', () => {
  assert.strictEqual(Checklist.estaCompleto([okItem(), okItem()]), true);
  assert.strictEqual(Checklist.estaCompleto([okItem(), okItem({ respuesta: undefined })]), false);
  // los no obligatorios no bloquean
  assert.strictEqual(Checklist.estaCompleto([okItem(), { obligatorio: false }]), true);
  // foto obligatoria sin foto bloquea
  assert.strictEqual(
    Checklist.estaCompleto([okItem({ foto_obligatoria: true, fotos: [] })]),
    false
  );
  // lista vacía no está completa
  assert.strictEqual(Checklist.estaCompleto([]), false);
});

test('itemsFaltantes lista exactamente los que bloquean', () => {
  const items = [okItem(), okItem({ respuesta: undefined }), { obligatorio: false }];
  const faltan = Checklist.itemsFaltantes(items);
  assert.strictEqual(faltan.length, 1);
  assert.strictEqual(faltan[0].respuesta, undefined);
});
