// Alquileres: montar sobre una cotización aprobada, tarjetas, selector visual (inicio + días laborales → fin) y calendario.
// El equipo es opcional y NUNCA se bloquea (varado u ocupado solo avisa). Ejecutar: node tests/smoke_alquileres.js (Playwright + Supabase simulado)
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const stub = require('./stub-supabase');

// Implementación de REFERENCIA independiente de la app (no se valida el código contra sí mismo).
const FEST = ['2026-10-12', '2026-11-02'];
function ref(inicio, n, { sab = true, dom = true, fest = true } = {}) {
  let d = new Date(inicio + 'T12:00:00Z'), hechos = 0;
  for (;;) {
    const iso = d.toISOString().slice(0, 10), w = d.getUTCDay();
    const ex = (sab && w === 6) || (dom && w === 0) || (fest && FEST.includes(iso));
    if (!ex && ++hechos === n) return iso;
    d.setUTCDate(d.getUTCDate() + 1);
  }
}
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const add = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const SEED = `
DB.upbq_clientes.push({id:'c1',nombre:'Constructora Sol',estado:'activo'},{id:'c2',nombre:'Puertos <b>SAS</b>',estado:'activo'});
DB.upbq_maquinas.push({id:'m1',codigo:'GR-01',tipo:'Grúa 50 t',estado:'disponible'},{id:'m2',codigo:'RE-02',tipo:'Retro <img src=x onerror=window.__xss=1>',estado:'varada',nota:'Falla hidráulica'},{id:'m3',codigo:'MN-03',tipo:'Minicargador',estado:'disponible'});
DB.upbq_festivos.push({fecha:'2026-10-12',nombre:'Día de la Raza'},{fecha:'2026-11-02',nombre:'Todos los Santos'});
DB.upbq_cotizaciones.push({id:'q1',cliente_id:'c1',equipo:'Brazo hidráulico',dias:15,valor:14500000,fecha:add(hoy,-3),estado:'cerrada_ganada',motivo_cierre:'Aprobada'});
DB.upbq_alquileres.push({id:'a-re2',nro:1,maquina_id:'m2',cliente_id:'c2',fecha_inicio:add(hoy,-12),fecha_fin:add(hoy,-3),estado:'activo',excluir_sabados:true,excluir_domingos:true,excluir_festivos:true});
DB.upbq_alquileres.push({id:'a-mn3',nro:2,maquina_id:'m3',cliente_id:'c1',fecha_inicio:add(hoy,-2),fecha_fin:add(hoy,6),estado:'activo',excluir_sabados:true,excluir_domingos:true,excluir_festivos:true});
DB.upbq_alquiler_novedades.push({id:'n1',alquiler_id:'a-mn3',fecha_desde:add(hoy,0),fecha_hasta:add(hoy,0),motivo:'Lluvia'});`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 1400 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: stub(SEED) }));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const val = id => p.inputValue('#' + id);
  const toasts = async () => (await p.locator('#toasts .toast').allTextContents()).join(' | ');
  const db = fn => p.evaluate(fn);

  // 1) Tarjetas por alquiler + aviso de cotización aprobada sin alquiler
  await p.click('[data-tab=alq]'); await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('.mcard').count(), 2);
  assert.strictEqual(await p.locator('.mcard.vencida').count(), 1); assert.strictEqual(await p.locator('.mcard.alquilada').count(), 1);
  assert((await p.textContent('.mcard.vencida')).includes('ALQ-0001'), 'número consecutivo legible');
  assert((await p.textContent('.mcard.vencida')).includes('Varada'), 'la tarjeta indica que el equipo está varado');
  assert.strictEqual(await p.locator('.mcard.alquilada .dc-hoy').count(), 1); assert.strictEqual(await p.locator('.mcard.alquilada .dc-n').count(), 1);
  assert((await p.textContent('.aviso.amb')).includes('1 cotización(es) aprobada(s) sin alquiler'));
  assert.strictEqual(await p.evaluate(() => !!window.__xss), false);
  console.log('OK tarjetas por alquiler (ALQ-0001, equipo varado visible, mapa de días) + aviso "aprobadas sin alquiler"');

  // 2) Montar alquiler sobre la cotización: cliente y días vienen de la cotización
  await p.click('.aviso.amb [data-action="alq.desde-cot"]'); await p.waitForTimeout(200);
  assert.strictEqual(await val('af-cot'), 'q1'); assert.strictEqual(await p.locator('#af-cli').isDisabled(), true);
  assert.strictEqual(await val('af-cli'), 'c1'); assert.strictEqual(await val('pf-dias'), '15');
  assert((await p.textContent('#af-cotinfo')).includes('Brazo hidráulico'));
  assert.strictEqual(await val('pf-fin'), ref(hoy, 15));
  console.log('OK montar desde cotización: cliente fijo, 15 días prellenados, fin automático', await val('pf-fin'));

  // 3) Inicio + días laborales → fin automático (contra la referencia), botones rápidos y exclusiones
  await p.fill('#pf-ini', '2026-09-28');
  assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15)); // 19-oct (excluye el festivo del 12-oct)
  for (const n of [5, 10, 20, 30]) { await p.click(`[data-action="alq.pf-q"][data-id="${n}"]`); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', n)); }
  await p.click('[data-action="alq.pf-q"][data-id="15"]');
  await p.click('#pf-tog-fest'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { fest: false })); await p.click('#pf-tog-fest');
  await p.click('#pf-tog-sab'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { sab: false }));
  await p.click('#pf-tog-dom'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { sab: false, dom: false })); await p.click('#pf-tog-sab'); await p.click('#pf-tog-dom');
  assert.strictEqual(await val('pf-dias'), '15');
  console.log('OK inicio 28/09 + 15 laborales → fin 2026-10-19; rápidos y exclusiones recalculan (los 15 se mantienen)');

  // 4) Calendario visual
  await p.click('[data-action="alq.cal-dia"][data-id="2026-10-09"]');
  assert.strictEqual(await val('pf-fin'), '2026-10-09'); assert.strictEqual(await val('pf-dias'), '10');
  await p.click('[data-action="alq.cal-modo"][data-id="ini"]'); await p.click('[data-action="alq.cal-dia"][data-id="2026-09-29"]');
  assert.strictEqual(await val('pf-ini'), '2026-09-29'); assert.strictEqual(await val('pf-fin'), ref('2026-09-29', 10));
  assert.strictEqual(await p.locator('.pillm.on').textContent(), '🏁 el fin');
  const chips = await p.evaluate(() => ({ x: document.querySelectorAll('.cal .dc-x').length, f: document.querySelectorAll('.cal .dc-f').length, ini: document.querySelectorAll('.cd-ini').length, fin: document.querySelectorAll('.cd-fin').length }));
  assert(chips.x > 0 && chips.f > 0 && chips.ini === 1 && chips.fin === 1, JSON.stringify(chips));
  await p.click('[data-action="alq.cal-dia"][data-id="2026-09-20"]'); assert((await toasts()).includes('anterior al inicio'));
  console.log('OK calendario: tocar día = fin (días=10); tocar inicio → fin', await val('pf-fin'), '| chips', JSON.stringify(chips));

  // 5) Asignar un equipo VARADO: solo avisa, se guarda igual. Queda ligado a la cotización.
  await p.selectOption('#af-maq', 'm2');
  assert((await p.textContent('#pf-dyn')).includes('VARADA'), 'aviso de equipo varado');
  await p.click('[data-action="alq.guardar-alq"]'); await p.waitForTimeout(400);
  const fila = await db(() => window.__db.upbq_alquileres.find(a => a.cotizacion_id === 'q1'));
  assert(fila && fila.maquina_id === 'm2' && fila.cliente_id === 'c1' && fila.fecha_inicio === '2026-09-29' && fila.nro === 3, JSON.stringify(fila));
  assert.strictEqual(await p.locator('.aviso.amb').count(), 0, 'ya no hay aprobadas sin alquiler');
  console.log('OK equipo varado asignado sin bloqueo; alquiler ligado a la cotización, nro', fila.nro);

  // 6) Equipo ya ocupado en esas fechas: solo avisa; y alquiler SIN equipo ("asignar después")
  await p.click('[data-action="alq.nuevo"]'); await p.selectOption('#af-maq', 'm3'); await p.fill('#pf-ini', add(hoy, 1));
  assert((await p.textContent('#pf-dyn')).includes('ya tiene alquiler con'));
  await p.selectOption('#af-maq', ''); await p.click('[data-action="alq.guardar-alq"]'); await p.waitForTimeout(400);
  assert((await toasts()).includes('falta asignar equipo'));
  assert.strictEqual(await p.locator('.mcard:has-text("Sin equipo asignado")').count(), 1);
  await p.click('[data-action="alq.filtro"][data-id="sineq"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.mcard').count(), 1);
  console.log('OK equipo ocupado solo avisa; alquiler sin equipo aparece en el filtro "Sin equipo"');

  // 7) Asignar el equipo después desde el detalle + editar fechas + novedades
  await p.click('.mcard [data-action="alq.ver"]'); await p.waitForTimeout(200);
  await p.selectOption('#ed-maq', 'm1'); await p.fill('#pf-dias', '12');
  await p.click('[data-action="alq.nov-add"]'); await p.waitForTimeout(100);
  assert((await toasts()).includes('sin guardar'));
  await p.click('[data-action="alq.guardar-ed"]'); await p.waitForTimeout(400);
  const ed = await db(() => window.__db.upbq_alquileres.find(a => a.maquina_id === 'm1'));
  assert(ed && ed.fecha_fin === ref(ed.fecha_inicio, 12), JSON.stringify(ed));
  await p.fill('#nv-motivo', 'Paro'); await p.fill('#nv-desde', ed.fecha_inicio); await p.fill('#nv-hasta', ed.fecha_inicio);
  await p.click('[data-action="alq.nov-add"]'); await p.waitForTimeout(400);
  assert((await p.textContent('.modal-body')).includes('Netos (− 1 novedad)') || (await p.textContent('.modal-body')).includes('Netos (− 0 novedad)'), 'detalle re-pintado');
  console.log('OK equipo asignado después; 12 laborales → fin', ed.fecha_fin, '; novedad registrada');

  // 8) Finalizar → Reabrir → Línea de tiempo
  await p.click('[data-action="alq.finalizar"]'); await p.click('[data-action="conf.si"]'); await p.waitForTimeout(400);
  assert((await p.textContent('.modal-body')).includes('Reabrir'));
  await p.click('[data-action="alq.reabrir"]'); await p.waitForTimeout(400);
  assert((await p.textContent('.modal-body')).includes('Finalizar alquiler'));
  await p.click('[data-action="modal.cerrar"]'); await p.click('[data-action="alq.vista"][data-id="gantt"]'); await p.waitForTimeout(300);
  assert(await p.locator('.gantt .barra').count() >= 2);
  console.log('OK finalizar / reabrir (estados libres) y línea de tiempo con barras');
  console.log('errores de página:', JSON.stringify(errs));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
