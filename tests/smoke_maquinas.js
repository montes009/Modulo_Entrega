// Máquinas: tarjetas, mapa de días, selector visual (inicio + días laborales → fin automático) y calendario.
// Ejecutar: node tests/smoke_maquinas.js   (requiere Playwright; usa un Supabase simulado)
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const stub = require('./stub-supabase');

// Implementación de REFERENCIA independiente de la app (para no validar el código contra sí mismo).
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
const SEED = `
DB.upbq_clientes.push({id:'c1',nombre:'Constructora Sol',estado:'activo'},{id:'c2',nombre:'Puertos <b>SAS</b>',estado:'activo'});
DB.upbq_maquinas.push({id:'m1',codigo:'GR-01',tipo:'Grúa 50 t'},{id:'m2',codigo:'RE-02',tipo:'Retro <img src=x onerror=window.__xss=1>'},{id:'m3',codigo:'MN-03',tipo:'Minicargador'});
DB.upbq_festivos.push({fecha:'2026-10-12',nombre:'Día de la Raza'},{fecha:'2026-11-02',nombre:'Todos los Santos'});
// RE-02: alquiler vencido sin finalizar; MN-03: activo hoy con una novedad
DB.upbq_alquileres.push({id:'a-re2',maquina_id:'m2',cliente_id:'c2',fecha_inicio:add(hoy,-12),fecha_fin:add(hoy,-3),estado:'activo',excluir_sabados:true,excluir_domingos:true,excluir_festivos:true});
DB.upbq_alquileres.push({id:'a-mn3',maquina_id:'m3',cliente_id:'c1',fecha_inicio:add(hoy,-2),fecha_fin:add(hoy,6),estado:'activo',excluir_sabados:true,excluir_domingos:true,excluir_festivos:true});
DB.upbq_alquiler_novedades.push({id:'n1',alquiler_id:'a-mn3',fecha_desde:hoy,fecha_hasta:hoy,motivo:'Lluvia'});`;

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 1400 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: stub(SEED) }));
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(500);
  const val = id => p.inputValue('#' + id);
  const toasts = async () => (await p.locator('#toasts .toast').allTextContents()).join(' | ');

  // 1) Tarjetas
  await p.click('[data-tab=maq]'); await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('.mcard').count(), 3);
  assert.strictEqual(await p.locator('.mcard.libre').count(), 1);
  assert.strictEqual(await p.locator('.mcard.vencida').count(), 1);
  assert.strictEqual(await p.locator('.mcard.alquilada').count(), 1);
  assert(await p.locator('.mcard.alquilada .dc-hoy').count() === 1, 'hoy marcado en el mapa de días');
  assert(await p.locator('.mcard.alquilada .dc-n').count() === 1, 'la novedad aparece como chip ámbar');
  assert.strictEqual(await p.evaluate(() => !!window.__xss), false);
  assert((await p.innerHTML('#vista')).includes('&lt;img'), 'tipo escapado');
  console.log('OK tarjetas: 1 libre, 1 vencida, 1 alquilada; mapa de días con hoy y novedad; XSS escapado');

  // 2) Nuevo alquiler: inicio + días laborales → fecha fin automática (contra la referencia)
  await p.click('.mcard.libre [data-action="maq.alq-nuevo"]'); await p.waitForTimeout(200);
  assert.strictEqual(await val('pf-dias'), '15');
  await p.fill('#pf-ini', '2026-09-28');
  assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15)); // 19-oct (excluye 12-oct festivo)
  console.log('OK inicio 28/09 + 15 días laborales → fin', await val('pf-fin'), '(festivo 12/10 excluido)');
  await p.fill('#pf-dias', '7');
  assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 7)); await p.fill('#pf-dias', '15');
  for (const n of [5, 10, 20, 30]) { await p.click(`[data-action="maq.pf-q"][data-id="${n}"]`); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', n)); assert.strictEqual(await val('pf-dias'), String(n)); }
  await p.click('[data-action="maq.pf-q"][data-id="15"]');
  console.log('OK botones rápidos 5/10/15/20/30 recalculan la fecha fin');

  // 3) Botones de exclusión
  await p.click('#pf-tog-fest'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { fest: false }));
  await p.click('#pf-tog-fest');
  await p.click('#pf-tog-sab'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { sab: false }));
  await p.click('#pf-tog-dom'); assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15, { sab: false, dom: false }));
  await p.click('#pf-tog-sab'); await p.click('#pf-tog-dom');
  assert.strictEqual(await val('pf-fin'), ref('2026-09-28', 15));
  assert.strictEqual(await val('pf-dias'), '15', 'los días laborales no cambian al excluir: cambia el calendario');
  console.log('OK excluir Sábados / Domingos / Festivos CO recalcula el fin (los 15 días laborales se mantienen)');

  // 4) Calendario visual: tocar un día cambia el fin (y recalcula los días) / el inicio (y recalcula el fin)
  await p.click('[data-action="maq.cal-dia"][data-id="2026-10-09"]');
  assert.strictEqual(await val('pf-fin'), '2026-10-09'); assert.strictEqual(await val('pf-dias'), '10');
  await p.click('[data-action="maq.cal-modo"][data-id="ini"]');
  await p.click('[data-action="maq.cal-dia"][data-id="2026-09-29"]');
  assert.strictEqual(await val('pf-ini'), '2026-09-29'); assert.strictEqual(await val('pf-fin'), ref('2026-09-29', 10));
  assert.strictEqual(await p.locator('.pillm.on').textContent(), '🏁 el fin', 'tras elegir inicio vuelve a modo fin');
  console.log('OK calendario: tocar día = fin (días=10); tocar inicio 29/09 → fin', await val('pf-fin'));
  const chips = await p.evaluate(() => ({ x: document.querySelectorAll('.cal .dc-x').length, f: document.querySelectorAll('.cal .dc-f').length, w: document.querySelectorAll('.cal .dc-w').length, ini: document.querySelectorAll('.cd-ini').length, fin: document.querySelectorAll('.cd-fin').length }));
  assert(chips.x > 0 && chips.f > 0 && chips.w > 0 && chips.ini === 1 && chips.fin === 1, JSON.stringify(chips));
  console.log('   chips del calendario:', JSON.stringify(chips));
  // fin anterior al inicio → aviso, no cambia
  await p.click('[data-action="maq.cal-dia"][data-id="2026-09-20"]'); assert((await toasts()).includes('anterior al inicio'));

  // 5) Guardar: persiste fechas y exclusiones
  await p.selectOption('#af-cli', 'c1'); await p.fill('#af-notas', 'Obra torre B');
  await p.click('#pf-tog-fest'); await p.click('[data-action="maq.guardar-alq"]'); await p.waitForTimeout(400);
  const fila = await p.evaluate(() => window.__db.upbq_alquileres.find(a => a.notas === 'Obra torre B'));
  assert(fila && fila.fecha_inicio === '2026-09-29' && fila.excluir_festivos === false && fila.excluir_sabados === true, JSON.stringify(fila));
  console.log('OK guardado: inicio', fila.fecha_inicio, 'fin', fila.fecha_fin, '| excluir sáb/dom/fest =', fila.excluir_sabados, fila.excluir_domingos, fila.excluir_festivos);
  assert.strictEqual(await p.locator('.mcard.alquilada').count(), 2);

  // 6) Choque de fechas con la misma máquina
  await p.click('.mcard:has-text("GR-01") [data-action="maq.alq-nuevo"]'); await p.fill('#pf-ini', '2026-10-01');
  await p.click('[data-action="maq.guardar-alq"]'); await p.waitForTimeout(150);
  assert((await toasts()).includes('ya está alquilada')); await p.click('[data-action="modal.cerrar"]');
  console.log('OK choque con otro alquiler de la misma máquina bloqueado');

  // 7) Detalle editable + novedades
  await p.click('.mcard:has-text("GR-01") [data-action="maq.ver"]'); await p.waitForTimeout(200);
  assert.strictEqual(await val('pf-ini'), '2026-09-29');
  await p.fill('#pf-dias', '12');
  await p.click('[data-action="maq.nov-add"]'); await p.waitForTimeout(100);
  assert((await toasts()).includes('sin guardar'), 'no deja registrar novedad con cambios sin guardar');
  await p.click('[data-action="maq.guardar-ed"]'); await p.waitForTimeout(400);
  const ed = await p.evaluate(() => window.__db.upbq_alquileres.find(a => a.notas === 'Obra torre B'));
  assert.strictEqual(ed.fecha_fin, ref('2026-09-29', 12, { fest: false }));
  console.log('OK edición: 12 días laborales → fin', ed.fecha_fin, '(se re-pinta el detalle abierto)');
  assert((await p.textContent('.modal-body')).includes('Período del alquiler'));
  await p.fill('#nv-motivo', 'Paro'); await p.click('[data-action="maq.nov-add"]'); await p.waitForTimeout(400);
  assert.strictEqual(await p.evaluate(() => window.__db.upbq_alquiler_novedades.filter(n => n.motivo === 'Paro').length), 1);
  assert((await p.textContent('.modal-body')).includes('Netos (− 1 novedad)'));
  console.log('OK novedad descuenta 1 día (netos); detalle re-pintado');

  // 8) Finalizar + historial + Gantt
  await p.click('[data-action="maq.finalizar"]'); await p.click('[data-action="conf.si"]'); await p.waitForTimeout(400);
  await p.click('[data-action="modal.cerrar"]');
  await p.click('[data-action="maq.filtro"][data-id="hist"]'); await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('.mcard.fin').count(), 1);
  await p.click('[data-action="maq.vista"][data-id="gantt"]'); await p.waitForTimeout(300);
  // La ventana del Gantt empieza el lunes de esta semana: el alquiler vencido (terminó antes) queda fuera → 2 barras.
  assert.strictEqual(await p.locator('.gantt .barra').count(), 2);
  assert.strictEqual(await p.locator('.gantt .barra.fin').count(), 1, 'el finalizado va en gris');
  console.log('OK finalizar → Historial (1 tarjeta); vista Gantt con barras');
  console.log('errores de página:', JSON.stringify(errs));
  await b.close();
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALLÓ:', e.message); process.exit(1); });
