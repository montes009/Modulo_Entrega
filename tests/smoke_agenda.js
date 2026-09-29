// Flujo de la agenda: cotización ("X pidió un brazo por 15 días, valor Y") → aprobada → montar alquiler sobre ella;
// y el Panel como agenda (recordatorios manuales/posponer, pendientes con fecha y prioridad).
// Ejecutar: node tests/smoke_agenda.js (Playwright + Supabase simulado)
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const stub = require('./stub-supabase');

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const add = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const SEED = `
DB.upbq_clientes.push({id:'c1',nombre:'Constructora Sol',estado:'activo'},{id:'c2',nombre:'Puertos y Obras',estado:'activo'});
DB.upbq_maquinas.push({id:'m1',codigo:'GR-01',tipo:'Grúa 50 t',estado:'disponible'});
DB.upbq_festivos.push({fecha:'2026-10-12',nombre:'Día de la Raza'});
DB.upbq_cotizaciones.push({id:'q2',cliente_id:'c2',equipo:'Compresor',dias:5,valor:3200000,fecha:add(hoy,-2),estado:'cerrada_ganada',motivo_cierre:'Aprobada por el cliente',fecha_cierre:add(hoy,-1)});`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 1400 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: stub(SEED) }));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const db = (fn, arg) => p.evaluate(fn, arg);
  const toasts = async () => (await p.locator('#toasts .toast').allTextContents()).join(' | ');
  const txt = sel => p.textContent(sel);

  // ── 1) Panel: la cotización aprobada sin alquiler se ve como pendiente de montar
  assert((await txt('#vista')).includes('Aprobadas: montar alquiler'));
  assert((await txt('.widget:has-text("Aprobadas: montar alquiler")')).includes('Puertos y Obras'));
  console.log('OK Panel: aparece "Aprobadas: montar alquiler" con el pedido (equipo · días · valor)');

  // ── 2) Cotización: "Constructora Sol pidió un brazo hidráulico por 15 días, valor $14.500.000"
  await p.click('[data-tab=cot]'); await p.waitForTimeout(300);
  await p.click('[data-action="cot.nuevo"]');
  await p.selectOption('#qf-cli', 'c1'); await p.fill('#qf-eq', 'Brazo hidráulico'); await p.fill('#qf-dias', '15'); await p.fill('#qf-val', '14500000');
  await p.click('[data-action="cot.guardar"]'); await p.waitForTimeout(400);
  const q = await db(() => window.__db.upbq_cotizaciones.find(x => x.equipo === 'Brazo hidráulico'));
  assert(q && q.dias === 15 && q.valor === 14500000 && q.estado === 'enviada', JSON.stringify(q));
  const rec = await db(() => window.__db.upbq_recordatorios.find(r => r.auto));
  assert(rec && rec.fecha === add(hoy, 3) && rec.cotizacion_id === q.id, 'recordatorio automático de seguimiento a 3 días');
  assert((await txt('.item:has-text("Brazo hidráulico")')).includes('15 días'));
  console.log('OK cotización con equipo + 15 días + valor; recordatorio de seguimiento automático para', rec.fecha);

  // ── 3) Editar la cotización (antes imposible)
  await p.click('.item:has-text("Brazo hidráulico")'); await p.click('[data-action="cot.editar"]');
  await p.fill('#qf-val', '15000000'); await p.fill('#qf-dias', '20'); await p.click('[data-action="cot.guardar"]'); await p.waitForTimeout(400);
  const q2 = await db(() => window.__db.upbq_cotizaciones.find(x => x.equipo === 'Brazo hidráulico'));
  assert(q2.valor === 15000000 && q2.dias === 20);
  assert((await txt('.modal-body')).includes('20 días'), 'el detalle abierto se re-pinta');
  await p.fill('#qf-val', '').catch(() => {});
  console.log('OK editar cotización: valor y días actualizados; detalle re-pintado');

  // ── 4) Aprobada → montar alquiler sobre esa cotización (días y cliente vienen de ella)
  await p.click('[data-action="cot.aprobar"]');
  await p.click('[data-action="cot.conf-aprobar"][data-montar="1"]'); await p.waitForTimeout(500);
  assert((await txt('.modal-body')).includes('Montar alquiler'), 'abre el formulario de alquiler');
  assert.strictEqual(await p.inputValue('#af-cot'), q.id); assert.strictEqual(await p.inputValue('#pf-dias'), '20'); assert.strictEqual(await p.inputValue('#af-cli'), 'c1');
  assert.strictEqual((await db(() => window.__db.upbq_recordatorios.find(r => r.auto).estado)), 'hecho', 'al aprobar se cierra el recordatorio de seguimiento');
  await p.fill('#pf-ini', '2026-09-28'); await p.selectOption('#af-maq', 'm1');
  await p.click('[data-action="alq.guardar-alq"]'); await p.waitForTimeout(400);
  const alq = await db(() => window.__db.upbq_alquileres.find(a => a.cotizacion_id));
  assert(alq && alq.maquina_id === 'm1' && alq.nro === 1 && alq.fecha_fin === '2026-10-26', JSON.stringify(alq)); // 20 laborales desde el lunes 28/09: 4 semanas + 1 día por el festivo del 12/10
  console.log('OK aprobada → alquiler montado sobre la cotización (20 laborales desde 28/09 → fin', alq.fecha_fin + ')');

  // ── 5) La cotización refleja el alquiler; "Ver alquiler" navega; reabrir y no aprobar
  await p.click('[data-tab=cot]'); await p.waitForTimeout(300);
  assert((await txt('.item:has-text("Brazo hidráulico")')).includes('ALQ-0001'));
  await p.click('.item:has-text("Brazo hidráulico")');
  assert((await txt('.modal-body')).includes('Alquiler montado'));
  await p.click('[data-action="cot.ver-alq"]'); await p.waitForTimeout(400);
  assert((await txt('.modal-body')).includes('ALQ-0001') && (await txt('.modal-body')).includes('Período del alquiler'));
  await p.click('[data-action="modal.cerrar"]'); await p.click('[data-tab=cot]'); await p.waitForTimeout(300);
  await p.click('.item:has-text("Brazo hidráulico")'); await p.click('[data-action="cot.reabrir"]'); await p.waitForTimeout(300);
  assert.strictEqual(await db(() => window.__db.upbq_cotizaciones.find(x => x.equipo === 'Brazo hidráulico').estado), 'en_seguimiento');
  await p.click('[data-action="cot.noaprobar"]'); await p.click('[data-action="cot.conf-rechazo"]'); await p.waitForTimeout(150);
  assert((await toasts()).includes('motivo es obligatorio'));
  await p.fill('#qc-motivo', 'Eligió a la competencia'); await p.click('[data-action="cot.conf-rechazo"]'); await p.waitForTimeout(300);
  assert.strictEqual(await db(() => window.__db.upbq_cotizaciones.find(x => x.equipo === 'Brazo hidráulico').estado), 'cerrada_perdida');
  await p.click('[data-action="modal.cerrar"]');
  console.log('OK cotización ↔ alquiler enlazados (badge ALQ-0001, Ver alquiler); reabrir; "no aprobada" exige motivo');

  // ── 6) Panel: recordatorio manual + posponer
  await p.click('[data-tab=pan]'); await p.waitForTimeout(400);
  await p.click('[data-action="pan.rec-nuevo"]'); await p.fill('#rf-texto', 'Llamar a Puertos por la proforma'); await p.click('[data-action="pan.rf-q"][data-id="0"]');
  await p.selectOption('#rf-cli', 'c2'); await p.click('[data-action="pan.rec-guardar"]'); await p.waitForTimeout(400);
  const rm = await db(() => window.__db.upbq_recordatorios.find(r => r.texto.startsWith('Llamar a Puertos')));
  assert(rm && rm.fecha === hoy && rm.cliente_id === 'c2' && rm.auto === false, JSON.stringify(rm));
  assert((await txt('.widget:has-text("Recordatorios")')).includes('Llamar a Puertos'));
  await p.click('.item:has-text("Llamar a Puertos") [data-action="pan.rec-pos"]'); await p.click('[data-action="pan.pos-q"][data-n="3"]'); await p.waitForTimeout(400);
  assert.strictEqual(await db(() => window.__db.upbq_recordatorios.find(r => r.texto.startsWith('Llamar a Puertos')).fecha), add(hoy, 3));
  assert(!(await txt('.widget:has-text("Recordatorios")')).includes('Llamar a Puertos'), 'pospuesto: sale de "hoy"');
  console.log('OK recordatorio manual (con cliente) y posponer +3 días');

  // ── 7) Pendientes = notas rápidas con fecha y prioridad (Enter para añadir)
  await p.fill('#pen-texto', 'Nota baja: revisar tarifas'); await p.selectOption('#pen-prio', 'baja'); await p.press('#pen-texto', 'Enter'); await p.waitForTimeout(300);
  await p.fill('#pen-texto', 'Renovar póliza de equipos'); await p.fill('#pen-fecha', add(hoy, -1)); await p.selectOption('#pen-prio', 'alta'); await p.press('#pen-texto', 'Enter'); await p.waitForTimeout(300);
  const orden = await p.locator('.item.pen b').allTextContents();
  assert.deepStrictEqual(orden, ['Renovar póliza de equipos', 'Nota baja: revisar tarifas'], 'alta primero');
  assert.strictEqual(await p.locator('.item.pen:has-text("Renovar") .dot.p-alta').count(), 1); assert.strictEqual(await p.locator('.item.pen:has-text("Renovar") .rojo').count(), 1, 'fecha vencida en rojo');
  await p.click('.item.pen:has-text("Nota baja") [data-action="pan.pen-editar"]'); await p.fill('#pf-texto', 'Nota media: revisar tarifas 2027'); await p.selectOption('#pf-prio', 'media'); await p.click('[data-action="pan.pen-guardar"]'); await p.waitForTimeout(300);
  assert((await txt('.widget:has-text("Pendientes")')).includes('tarifas 2027'));
  await p.click('.item.pen:has-text("Renovar") [data-action="pan.pen-hecho"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.item.pen').count(), 1);
  await p.click('[data-action="pan.pen-ver-hechos"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.item.pen.hecha').count(), 1);
  await p.click('.item.pen.hecha [data-action="pan.pen-reab"]'); await p.waitForTimeout(300);
  await p.click('.item.pen:has-text("tarifas") [data-action="pan.pen-borrar"]'); await p.click('[data-action="conf.si"]'); await p.waitForTimeout(300);
  assert.strictEqual(await db(() => window.__db.upbq_pendientes.length), 1);
  console.log('OK pendientes: Enter añade, orden por prioridad, fecha vencida en rojo, editar, hecho/reabrir, borrar con confirmación');

  // ── 8) Panel → "Montar" la cotización aprobada que quedaba
  await p.click('.widget:has-text("Aprobadas: montar alquiler") [data-action="pan.montar"]'); await p.waitForTimeout(500);
  assert.strictEqual(await p.inputValue('#af-cot'), 'q2'); assert.strictEqual(await p.inputValue('#pf-dias'), '5');
  console.log('OK desde el Panel se monta el alquiler de la otra cotización aprobada (5 días prellenados)');
  console.log('errores de página:', JSON.stringify(errs));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
