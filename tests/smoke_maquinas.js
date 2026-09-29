// Cuadro de máquinas = SOLO la visual de equipos disponibles y varados; el estado se cambia libremente con un clic.
// Ejecutar: node tests/smoke_maquinas.js (Playwright + Supabase simulado)
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const stub = require('./stub-supabase');

const SEED = `
DB.upbq_clientes.push({id:'c1',nombre:'Constructora Sol',estado:'activo'});
DB.upbq_maquinas.push({id:'m1',codigo:'GR-01',tipo:'Grúa 50 t',estado:'disponible'},{id:'m2',codigo:'RE-02',tipo:'Retro <img src=x onerror=window.__xss=1>',estado:'varada',nota:'Falla hidráulica'},{id:'m3',codigo:'MN-03',tipo:'Minicargador',estado:'disponible'},{id:'m4',codigo:'PL-04',tipo:'Plataforma',estado:'disponible'});
DB.upbq_alquileres.push({id:'a1',nro:1,maquina_id:'m1',cliente_id:'c1',fecha_inicio:add(hoy,-2),fecha_fin:add(hoy,5),estado:'activo'});
DB.upbq_alquileres.push({id:'a2',nro:2,maquina_id:'m2',cliente_id:'c1',fecha_inicio:add(hoy,-1),fecha_fin:add(hoy,3),estado:'activo'});
DB.upbq_alquileres.push({id:'a3',nro:3,maquina_id:'m3',cliente_id:'c1',fecha_inicio:add(hoy,4),fecha_fin:add(hoy,9),estado:'activo'});`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 1200 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: stub(SEED) }));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const estado = id => p.evaluate(i => window.__db.upbq_maquinas.find(m => m.id === i).estado, id);
  const toasts = async () => (await p.locator('#toasts .toast').allTextContents()).join(' | ');

  await p.click('[data-tab=maq]'); await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('.mcard').count(), 4);
  assert.strictEqual(await p.locator('.mcard.libre').count(), 3); assert.strictEqual(await p.locator('.mcard.varada').count(), 1);
  const kp = await p.locator('.kpis-top b').allTextContents(); assert.deepStrictEqual(kp, ['4', '3', '1'], 'equipos / disponibles / varadas');
  assert((await p.textContent('.mcard:has-text("GR-01")')).includes('En alquiler:'));
  assert((await p.textContent('.mcard:has-text("MN-03")')).includes('Próximo alquiler:'));
  assert((await p.textContent('.mcard:has-text("PL-04")')).includes('Sin alquiler asignado'));
  assert((await p.textContent('.mcard:has-text("RE-02")')).includes('Varada con un alquiler en curso'));
  assert((await p.textContent('.mcard:has-text("RE-02")')).includes('Falla hidráulica'));
  assert.strictEqual(await p.evaluate(() => !!window.__xss), false);
  console.log('OK tablero: 3 disponibles + 1 varada; info de alquiler solo informativa; varada con alquiler se avisa; XSS escapado');

  // Estado libre con un clic (sin confirmaciones)
  await p.click('.mcard:has-text("GR-01") [data-action="maq.toggle"]'); await p.waitForTimeout(300);
  assert.strictEqual(await estado('m1'), 'varada'); assert((await toasts()).includes('anotar el motivo'));
  assert.strictEqual(await p.locator('.mcard.varada').count(), 2);
  await p.click('.mcard:has-text("GR-01") [data-action="maq.toggle"]'); await p.waitForTimeout(300);
  assert.strictEqual(await estado('m1'), 'disponible');
  await p.click('.mcard:has-text("RE-02") [data-action="maq.toggle"]'); await p.waitForTimeout(300);
  assert.strictEqual(await estado('m2'), 'disponible');
  console.log('OK estados libres: disponible ↔ varada con un clic, en cualquier equipo (incluso con alquiler en curso)');

  // Filtros
  await p.click('[data-action="maq.filtro"][data-id="varada"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.mcard').count(), 0); assert((await p.textContent('#vista')).includes('Nada en este filtro'));
  await p.click('[data-action="maq.filtro"][data-id=""]');

  // Editar: estado + nota rápida
  await p.click('.mcard:has-text("PL-04") [data-action="maq.editar"]'); await p.waitForTimeout(200);
  await p.selectOption('#mf-est', 'varada'); await p.fill('#mf-nota', 'Sin batería, llega el martes'); await p.fill('#mf-tipo', 'Plataforma tijera');
  await p.click('[data-action="maq.guardar"]'); await p.waitForTimeout(300);
  const pl = await p.evaluate(() => window.__db.upbq_maquinas.find(m => m.id === 'm4'));
  assert(pl.estado === 'varada' && pl.nota === 'Sin batería, llega el martes' && pl.tipo === 'Plataforma tijera', JSON.stringify(pl));
  assert((await p.textContent('.mcard:has-text("PL-04")')).includes('Sin batería'));
  console.log('OK editar: estado + nota rápida + tipo');

  // Nueva máquina (duplicado rechazado) y eliminar (con alquileres no; sin alquileres sí)
  await p.click('[data-action="maq.nueva"]'); await p.fill('#mf-cod', 'GR-01'); await p.click('[data-action="maq.guardar"]'); await p.waitForTimeout(200);
  assert((await toasts()).includes('Ya existe una máquina')); await p.fill('#mf-cod', 'CP-05'); await p.fill('#mf-tipo', 'Compresor'); await p.click('[data-action="maq.guardar"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.mcard').count(), 5);
  await p.click('.mcard:has-text("GR-01") [data-action="maq.editar"]'); await p.click('[data-action="maq.borrar"]'); await p.click('[data-action="conf.si"]'); await p.waitForTimeout(300);
  assert((await toasts()).includes('tiene alquileres asociados')); assert.strictEqual(await p.evaluate(() => window.__db.upbq_maquinas.length), 5);
  await p.click('[data-action="modal.cerrar"]');
  await p.click('.mcard:has-text("CP-05") [data-action="maq.editar"]'); await p.click('[data-action="maq.borrar"]'); await p.click('[data-action="conf.si"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.evaluate(() => window.__db.upbq_maquinas.length), 4);
  console.log('OK nueva máquina (duplicado rechazado); eliminar solo si no tiene alquileres');
  console.log('errores de página:', JSON.stringify(errs));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
