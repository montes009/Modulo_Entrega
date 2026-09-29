(function (global) {
  'use strict';
  // Alquileres. Se MONTAN sobre una cotización aprobada (o sueltos). Vista principal = TARJETAS por alquiler con su "mapa de días";
  // vista secundaria = línea de tiempo. El equipo es opcional y nunca se bloquea (se puede asignar aunque esté varado o
  // ya ocupado: solo se avisa). Las fechas se editan con un selector visual: inicio + días laborales → fin automático.
  const U = global.UPBQ, H = U.Habiles, fmt = U.fmtFecha, money = U.fmtMoney, AE = global.UPBQ_EST.alquiler;
  const DIAS_GANTT = 35, DW = 30, MAX_CHIPS = 42;
  const LETRAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const DOW2 = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const ETQ = { activo: 'Activo', porIniciar: 'Por iniciar', vencido: 'Vencido', finalizado: 'Finalizado' };
  const CSS = { activo: 'alquilada', porIniciar: 'reservada', vencido: 'vencida', finalizado: 'fin' };
  let alquileres = [], maquinas = [], clientes = [], cotsAprob = [], ini = null, detalleId = null, vista = 'tarjetas', filtro = '';
  let f = null; // formulario de período (nuevo alquiler / edición)

  function lunesDe(iso) { return U.addDays(iso, -((H.dow(iso) + 6) % 7)); }
  function nom(a) { return a.upbq_clientes ? a.upbq_clientes.nombre : '—'; }
  function refAlq(a) { return 'ALQ-' + (a.nro != null ? String(a.nro).padStart(4, '0') : String(a.id).slice(-4).toUpperCase()); }
  function novs(a) { return a.upbq_alquiler_novedades || []; }
  function ddmm(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function addMeses(ym, n) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); }
  function maquina(id) { return id ? maquinas.find(m => m.id === id) || null : null; }
  function etiquetaMaq(m) { return m.codigo + (m.tipo ? ' · ' + m.tipo : ''); }
  function claveAlq(a, hoy) {
    if (a.estado === 'finalizado') return 'finalizado';
    if (a.fecha_fin < hoy) return 'vencido';
    return a.fecha_inicio > hoy ? 'porIniciar' : 'activo';
  }
  function cotsLibres() { const usadas = new Set(alquileres.map(a => a.cotizacion_id).filter(Boolean)); return cotsAprob.filter(q => !usadas.has(q.id)); }

  async function cargar() {
    const [a, m, c, q] = await Promise.all([
      U.sb.from('upbq_alquileres').select('*, upbq_clientes(nombre), upbq_alquiler_novedades(*), upbq_cotizaciones(equipo,valor,dias)').order('fecha_inicio'),
      U.sb.from('upbq_maquinas').select('*').order('codigo'),
      U.sb.from('upbq_clientes').select('id,nombre').order('nombre'),
      U.sb.from('upbq_cotizaciones').select('id,cliente_id,equipo,valor,dias,fecha,upbq_clientes(nombre)').eq('estado', 'cerrada_ganada').order('fecha', { ascending: false }),
      H.cargar()
    ]);
    for (const r of [a, m, c, q]) if (r.error) throw r.error;
    alquileres = a.data; maquinas = m.data; clientes = c.data; cotsAprob = q.data;
  }

  // ---------- Mapa de días (chips) ----------
  function claseChip(iso, o, nv, hoy) {
    if (H.esExcluido(iso, o)) return 'dc-x';
    if (H.enNovedad(iso, nv)) return 'dc-n';
    return iso > hoy ? 'dc-f' : 'dc-w';
  }
  function mapaDias(a, hoy) {
    const o = H.opcionesDe(a), nv = novs(a);
    let d0 = a.fecha_inicio, d1 = a.fecha_fin, pre = '', post = '';
    if (U.diffDays(d0, d1) + 1 > MAX_CHIPS) { // alquileres largos: ventana alrededor de hoy
      let w0 = U.addDays(hoy, -10); if (w0 < d0) w0 = d0;
      let w1 = U.addDays(w0, MAX_CHIPS - 1);
      if (w1 > d1) { w1 = d1; w0 = U.addDays(w1, -(MAX_CHIPS - 1)); if (w0 < d0) w0 = d0; }
      if (w0 > d0) pre = '<span class="dmas">…</span>';
      if (w1 < d1) post = '<span class="dmas">…</span>';
      d0 = w0; d1 = w1;
    }
    let h = '';
    for (let d = d0; d <= d1; d = U.addDays(d, 1)) {
      const mot = H.motivoExclusion(d, o) || (H.enNovedad(d, nv) ? 'Novedad' : d > hoy ? 'Por trabajar' : 'Trabajado');
      h += '<span class="dc ' + claseChip(d, o, nv, hoy) + (d === hoy ? ' dc-hoy' : '') + '" title="' + esc(fmt(d) + ' · ' + mot) + '">' + esc(ddmm(d)) + '</span>';
    }
    return '<div class="dstrip">' + pre + h + post + '</div>';
  }
  const LEYENDA = '<div class="leyenda"><span><i class="dc dc-w"></i>Trabajado</span><span><i class="dc dc-f"></i>Por trabajar</span><span><i class="dc dc-n"></i>Novedad</span><span><i class="dc dc-x"></i>Excluido</span><span><i class="dc dc-hoy"></i>Hoy</span></div>';

  // ---------- Tarjetas ----------
  function fechasAlq(a, hoy) {
    const r = H.contar(a.fecha_inicio, a.fecha_fin, novs(a), H.opcionesDe(a));
    const falta = U.diffDays(hoy, a.fecha_fin);
    let txt, cls;
    if (a.estado === 'finalizado') { txt = 'Finalizado'; cls = 'days-ok'; }
    else if (a.fecha_inicio > hoy) { txt = 'Inicia en ' + U.diffDays(hoy, a.fecha_inicio) + ' d'; cls = 'days-warn'; }
    else if (falta < 0) { txt = 'Venció hace ' + (-falta) + ' d'; cls = 'days-expired'; }
    else if (falta === 0) { txt = 'Vence hoy'; cls = 'days-urgent'; }
    else { txt = 'Faltan ' + falta + ' d'; cls = falta <= 2 ? 'days-urgent' : falta <= 5 ? 'days-warn' : 'days-ok'; }
    return '<div class="mc-dates"><div>Inicio <b>' + esc(fmt(a.fecha_inicio)) + '</b></div><div>Días <b>' + r.netos + '</b>' +
      (r.descontados ? ' <small>(' + r.habiles + ' − ' + r.descontados + ')</small>' : '') + '</div><div>Vence <b>' + esc(fmt(a.fecha_fin)) + '</b></div></div>' +
      '<span class="days-badge ' + cls + '">' + esc(txt) + '</span>' + mapaDias(a, hoy);
  }
  function tarjeta(a, hoy) {
    const k = claveAlq(a, hoy), m = maquina(a.maquina_id), cot = a.upbq_cotizaciones;
    const equipo = m ? esc(etiquetaMaq(m)) + (m.estado === 'varada' ? ' <span class="badge est-varada">Varada</span>' : '') : '<span class="sin-eq">⚠ Sin equipo asignado</span>';
    return '<div class="mcard ' + CSS[k] + '" data-action="alq.ver" data-id="' + esc(a.id) + '">' +
      '<div class="mc-top"><div><div class="mc-id">' + esc(nom(a)) + '</div><div class="mc-tipo">' + equipo + '</div></div>' +
      '<div class="mc-der"><span class="badge est-' + CSS[k] + '">' + esc(ETQ[k]) + '</span><span class="mc-ref">' + esc(refAlq(a)) + '</span></div></div>' +
      '<div class="mc-body">' + (cot ? '<div class="mc-sig">Pidió: <b>' + esc(cot.equipo || '—') + '</b>' + (cot.dias ? ' · ' + cot.dias + ' días' : '') + (cot.valor != null ? ' · ' + esc(money(cot.valor)) : '') + '</div>' : '') +
      fechasAlq(a, hoy) + (a.notas ? '<div class="mc-nota">📝 ' + esc(a.notas) + '</div>' : '') + '</div>' +
      '<div class="mc-foot"><button class="btn mini-b" data-action="alq.ver" data-id="' + esc(a.id) + '">' + (m || a.estado === 'finalizado' ? 'Ver detalle' : 'Asignar equipo') + '</button></div></div>';
  }

  async function render() {
    await cargar();
    const hoy = U.today();
    const clave = a => claveAlq(a, hoy);
    const vivos = alquileres.filter(a => a.estado !== 'finalizado');
    const cnt = k => alquileres.filter(a => clave(a) === k).length;
    const sinEq = vivos.filter(a => !a.maquina_id).length;
    const libres = cotsLibres();
    const kpi = (v, l, c) => '<div><b class="' + c + '">' + v + '</b><small>' + l + '</small></div>';
    const cabecera = '<div class="head"><h2>Alquileres</h2><div class="row">' +
      '<button class="btn' + (vista === 'tarjetas' ? ' primary' : '') + '" data-action="alq.vista" data-id="tarjetas">Tarjetas</button>' +
      '<button class="btn' + (vista === 'gantt' ? ' primary' : '') + '" data-action="alq.vista" data-id="gantt">Línea de tiempo</button>' +
      '<button class="btn primary" data-action="alq.nuevo" data-id="">+ Alquiler</button></div></div>';
    const porMontar = libres.length ? '<div class="aviso amb">🚀 <b>' + libres.length + ' cotización(es) aprobada(s) sin alquiler:</b> ' +
      libres.slice(0, 4).map(q => '<button class="btn mini-b" data-action="alq.desde-cot" data-id="' + esc(q.id) + '">' + esc((q.upbq_clientes ? q.upbq_clientes.nombre : '—') + ' · ' + (q.equipo || 'equipo')) + '</button>').join(' ') + '</div>' : '';
    const kpis = '<div class="kpis kpis-top">' + kpi(cnt('activo'), 'Activos', 'v-pri') + kpi(cnt('porIniciar'), 'Por iniciar', 'v-warn') + kpi(cnt('vencido'), 'Vencidos', 'v-bad') + kpi(sinEq, 'Sin equipo', 'v-warn') + '</div>';
    let cuerpo;
    if (vista === 'gantt') cuerpo = ganttHTML(hoy);
    else {
      const chip = (k, l, n) => '<button class="chip' + (filtro === k ? ' on' : '') + '" data-action="alq.filtro" data-id="' + k + '">' + l + ' (' + n + ')</button>';
      const chips = '<div class="chips">' + chip('', 'En curso', vivos.length) + chip('activo', 'Activos', cnt('activo')) + chip('porIniciar', 'Por iniciar', cnt('porIniciar')) +
        chip('vencido', 'Vencidos', cnt('vencido')) + chip('sineq', 'Sin equipo', sinEq) + chip('finalizado', 'Finalizados', cnt('finalizado')) + '</div>';
      const lista = alquileres.filter(a => filtro === '' ? a.estado !== 'finalizado' : filtro === 'sineq' ? (a.estado !== 'finalizado' && !a.maquina_id) : clave(a) === filtro)
        .sort((x, y) => filtro === 'finalizado' ? (x.fecha_fin < y.fecha_fin ? 1 : -1) : (x.fecha_inicio < y.fecha_inicio ? -1 : 1));
      cuerpo = chips + (lista.length ? '<div class="mgrid">' + lista.map(a => tarjeta(a, hoy)).join('') + '</div>' : '<p class="vacio">Nada en este filtro.</p>') + LEYENDA;
    }
    document.getElementById('vista').innerHTML = cabecera + porMontar + kpis + cuerpo;
  }

  // ---------- Línea de tiempo ----------
  function ganttHTML(hoy) {
    if (!ini) ini = lunesDe(hoy);
    const fin = U.addDays(ini, DIAS_GANTT - 1);
    let cab = '';
    for (let i = 0; i < DIAS_GANTT; i++) {
      const d = U.addDays(ini, i), [, mm, dd] = d.split('-');
      const cls = (H.esFestivo(d) ? ' fest' : H.esFinDeSemana(d) ? ' fds' : '') + (d === hoy ? ' hoy' : '');
      const mes = (dd === '01' || i === 0) ? '<i>' + MESES[Number(mm) - 1] + '</i>' : '';
      cab += '<div class="gd' + cls + '" title="' + esc(H.nombreFestivo(d) || fmt(d)) + '">' + mes + LETRAS[H.dow(d)] + '<b>' + Number(dd) + '</b></div>';
    }
    const filas = maquinas.map(m => ({ id: m.id, etq: '<b>' + esc(m.codigo) + '</b><small>' + esc(m.tipo || '') + '</small><span class="badge est-' + (m.estado === 'varada' ? 'varada' : 'libre') + '">' + esc(global.UPBQ_EST.maquina[m.estado] || m.estado) + '</span>' }))
      .concat(alquileres.some(a => !a.maquina_id) ? [{ id: '', etq: '<b>Sin equipo</b><small>por asignar</small>' }] : [])
      .map(fila => {
        let celdas = '';
        for (let i = 0; i < DIAS_GANTT; i++) {
          const d = U.addDays(ini, i);
          celdas += '<div class="gc' + (H.esFestivo(d) ? ' fest' : H.esFinDeSemana(d) ? ' fds' : '') + (d === hoy ? ' hoy' : '') + '"></div>';
        }
        const barras = alquileres.filter(a => (a.maquina_id || '') === fila.id && a.fecha_fin >= ini && a.fecha_inicio <= fin).map(a => {
          const desde = a.fecha_inicio < ini ? ini : a.fecha_inicio, hasta = a.fecha_fin > fin ? fin : a.fecha_fin;
          const venc = a.estado === 'activo' && a.fecha_fin < hoy;
          return '<div class="barra ' + (a.estado === 'finalizado' ? 'fin' : venc ? 'venc' : 'act') + '" style="left:' + U.diffDays(ini, desde) * DW + 'px;width:' + (U.diffDays(desde, hasta) + 1) * DW + 'px" data-action="alq.ver" data-id="' + esc(a.id) + '" title="' +
            esc(nom(a) + ' · ' + fmt(a.fecha_inicio) + ' → ' + fmt(a.fecha_fin)) + '">' + esc(nom(a)) + ' · ' + esc(fmt(a.fecha_inicio).slice(0, 5)) + '–' + esc(fmt(a.fecha_fin).slice(0, 5)) + '</div>';
        }).join('');
        return '<div class="gfila"><div class="gnom">' + fila.etq + '</div><div class="gtrack">' + celdas + barras + '</div></div>';
      }).join('');
    const aviso = H.cubre(fin) ? '' : '<p class="aviso">⚠ Faltan festivos cargados para ' + fin.slice(0, 4) + ': los días laborales se cuentan solo excluyendo fines de semana.</p>';
    return '<div class="row"><button class="btn" data-action="alq.nav" data-id="-14">◀</button><button class="btn" data-action="alq.nav" data-id="0">Hoy</button><button class="btn" data-action="alq.nav" data-id="14">▶</button></div>' + aviso +
      '<div class="gantt" style="--dw:' + DW + 'px;--n:' + DIAS_GANTT + '"><div class="gfila gcab"><div class="gnom"></div><div class="gtrack">' + cab + '</div></div>' + filas + '</div>' +
      '<p class="leyenda"><span class="barra act">Activo</span> <span class="barra venc">Vencido sin finalizar</span> <span class="barra fin">Finalizado</span> · sombreado = fin de semana / festivo</p>';
  }

  // ---------- Selector visual de período (inicio + días laborales → fin, calendario) ----------
  const PILLS = [['sab', 'Sábados'], ['dom', 'Domingos'], ['fest', 'Festivos CO']];
  function pickerHTML() {
    return '<div class="pf"><div class="row2"><label>Fecha de inicio<input id="pf-ini" type="date" data-oninput="alq.pf-ini"></label>' +
      '<label>Días laborales<input id="pf-dias" type="number" min="1" step="1" data-oninput="alq.pf-dias"></label></div>' +
      '<div class="quick"><span class="lbl">Rápido:</span>' + [5, 10, 15, 20, 30].map(n => '<button class="btn mini-b" data-action="alq.pf-q" data-id="' + n + '">' + n + '</button>').join('') + '</div>' +
      '<div class="quick"><span class="lbl">Excluir:</span>' + PILLS.map(p => '<button id="pf-tog-' + p[0] + '" class="pillx" data-action="alq.pf-tog" data-id="' + p[0] + '">' + p[1] + '</button>').join('') + '</div>' +
      '<label>Fecha fin <small>(se calcula sola; también puedes cambiarla aquí o en el calendario)</small><input id="pf-fin" type="date" data-oninput="alq.pf-fin"></label>' +
      '<div id="pf-dyn"></div></div>';
  }
  function calendarioHTML(hoy) {
    const base = f.ini || hoy, fin = f.fin && f.fin >= base ? f.fin : base;
    let ym = addMeses(base.slice(0, 7), -f.antes);
    // Mes extra al final solo si el fin cae cerca de fin de mes (para poder alargar) o si el usuario lo pide.
    const [fy, fm, fd] = fin.split('-').map(Number), restan = new Date(Date.UTC(fy, fm, 0)).getUTCDate() - fd;
    const ymFin = addMeses(fin.slice(0, 7), f.despues + (restan < 7 ? 1 : 0));
    let bloques = '', guardia = 0;
    for (; ym <= ymFin && guardia < 10; ym = addMeses(ym, 1), guardia++) {
      const [y, m] = ym.split('-').map(Number), primero = ym + '-01', n = new Date(Date.UTC(y, m, 0)).getUTCDate();
      let celdas = '';
      for (let i = 0; i < H.dow(primero); i++) celdas += '<span class="cd cd-vacio"></span>';
      for (let d = 1; d <= n; d++) {
        const iso = ym + '-' + String(d).padStart(2, '0'), ex = H.esExcluido(iso, f.opts);
        const enRango = f.ini && f.fin && iso >= f.ini && iso <= f.fin;
        let cls = enRango ? (ex ? 'dc-x' : H.enNovedad(iso, f.novs) ? 'dc-n' : iso > hoy ? 'dc-f' : 'dc-w') : ('cd-out' + (ex ? ' cd-out-x' : ''));
        if (iso === hoy) cls += ' dc-hoy';
        if (iso === f.ini) cls += ' cd-ini';
        if (iso === f.fin) cls += ' cd-fin';
        const tip = fmt(iso) + (iso === f.ini ? ' · INICIO' : '') + (iso === f.fin ? ' · FIN' : '') + (ex ? ' · ' + H.motivoExclusion(iso, f.opts) + ' (excluido)' : '');
        celdas += '<button type="button" class="cd ' + cls + '" title="' + esc(tip) + '" data-action="alq.cal-dia" data-id="' + iso + '">' + d + '</button>';
      }
      bloques += '<div class="cmes"><div class="cmes-t">' + MESES[m - 1] + ' ' + y + '</div><div class="cgrid">' + DOW2.map(x => '<i>' + x + '</i>').join('') + celdas + '</div></div>';
    }
    return '<div class="cal-modo"><span class="lbl">Al tocar un día cambias:</span>' +
      '<button type="button" class="pillm' + (f.sel === 'ini' ? ' on' : '') + '" data-action="alq.cal-modo" data-id="ini">📍 el inicio</button>' +
      '<button type="button" class="pillm' + (f.sel === 'fin' ? ' on' : '') + '" data-action="alq.cal-modo" data-id="fin">🏁 el fin</button></div>' +
      '<div class="cal">' + bloques + '</div><div class="row"><button type="button" class="btn mini-b" data-action="alq.cal-mes" data-id="-1">＋ mes anterior</button><button type="button" class="btn mini-b" data-action="alq.cal-mes" data-id="1">＋ mes siguiente</button></div>';
  }
  // Avisos del equipo elegido: NUNCA bloquean (varado o con otro alquiler en las mismas fechas se puede asignar igual).
  function avisosEquipo() {
    const av = [], m = maquina(f.maqId);
    if (!m) return av;
    if (m.estado === 'varada') av.push('⚠ ' + m.codigo + ' está marcada como VARADA' + (m.nota ? ' (' + m.nota + ')' : '') + '. Se puede asignar igual.');
    if (f.ini && f.fin && f.fin >= f.ini) {
      const c = alquileres.find(x => x.id !== f.id && x.maquina_id === m.id && x.estado === 'activo' && x.fecha_inicio <= f.fin && x.fecha_fin >= f.ini);
      if (c) av.push('⚠ ' + m.codigo + ' ya tiene alquiler con ' + nom(c) + ' del ' + fmt(c.fecha_inicio) + ' al ' + fmt(c.fecha_fin) + '. Se puede guardar igual.');
    }
    return av;
  }
  function dynHTML() {
    const hoy = U.today(), ok = f.ini && f.fin && f.fin >= f.ini;
    const r = ok ? H.contar(f.ini, f.fin, f.novs, f.opts) : { habiles: 0, excluidos: 0, calendario: 0, descontados: 0, netos: 0 };
    let h = avisosEquipo().map(t => '<p class="aviso">' + esc(t) + '</p>').join('');
    h += '<div class="kpis"><div><b class="v-ok">' + r.habiles + '</b><small>Días laborales</small></div><div><b class="v-warn">' + r.excluidos + '</b><small>Días excluidos</small></div>' +
      '<div><b class="v-pri">' + r.calendario + '</b><small>Días calendario</small></div>' + (f.modo === 'editar' ? '<div><b>' + r.netos + '</b><small>Netos (− ' + r.descontados + ' novedad)</small></div>' : '') + '</div>';
    h += '<div class="fechas"><div><small>Inicio</small><b>' + esc(f.ini ? fmt(f.ini) : '—') + '</b></div><div class="fin"><small>Fecha fin estimada</small><b>' + esc(f.fin ? fmt(f.fin) : '—') + '</b></div></div>';
    if (f.ini && f.fin && f.fin < f.ini) h += '<p class="aviso rojo">La fecha fin no puede ser anterior al inicio.</p>';
    else if (ok && r.habiles < 1) h += '<p class="aviso rojo">El período debe tener al menos 1 día laboral.</p>';
    if (f.fin && !H.cubre(f.fin)) h += '<p class="aviso">⚠ Faltan festivos cargados para ' + esc(f.fin.slice(0, 4)) + ': solo se excluyen los fines de semana.</p>';
    h += calendarioHTML(hoy) + LEYENDA;
    if (ok) {
      const ex = [];
      for (let d = f.ini; d <= f.fin && ex.length < 40; d = U.addDays(d, 1)) if (H.esExcluido(d, f.opts)) ex.push('<span class="exc">' + esc(ddmm(d) + ' ' + H.motivoExclusion(d, f.opts)) + '</span>');
      h += '<div class="exlist"><small>Excluidos:</small> ' + (ex.length ? ex.join('') : '<span class="ok">Sin días excluidos — todos los días cuentan</span>') + '</div>';
    }
    return h;
  }
  function textoCot(q) {
    return q ? 'Pidió: <b>' + esc(q.equipo || '—') + '</b>' + (q.dias ? ' · ' + q.dias + ' días' : '') + (q.valor != null ? ' · ' + esc(money(q.valor)) : '') : '';
  }
  function pintarPicker(quien) {
    const dyn = document.getElementById('pf-dyn');
    if (!dyn) return;
    dyn.innerHTML = dynHTML();
    PILLS.forEach(p => { const b = document.getElementById('pf-tog-' + p[0]); if (b) b.classList.toggle('on', !!f.opts[p[0]]); });
    [['pf-ini', f.ini || ''], ['pf-dias', f.dias || ''], ['pf-fin', f.fin || '']].forEach(([id, v]) => {
      const el = document.getElementById(id);
      if (el && el !== quien && el !== document.activeElement && el.value !== String(v)) el.value = v;
    });
    const info = document.getElementById('af-cotinfo');
    if (info) info.innerHTML = f.cotId ? textoCot(cotsAprob.find(q => q.id === f.cotId)) : '';
  }
  function recalcFin() { f.fin = f.ini && f.dias >= 1 ? H.fechaFin(f.ini, f.dias, f.opts) : f.fin; }
  function recalcDias() { f.dias = f.ini && f.fin && f.fin >= f.ini ? H.contar(f.ini, f.fin, null, f.opts).habiles : 0; }

  function handleInput(a, el) {
    if (!f) return;
    if (a === 'pf-ini') { f.ini = el.value; recalcFin(); }
    else if (a === 'pf-dias') { const n = parseInt(el.value, 10); if (n >= 1) { f.dias = n; recalcFin(); } }
    else if (a === 'pf-fin') { f.fin = el.value; recalcDias(); }
    else if (a === 'pf-maq') f.maqId = el.value;
    else if (a === 'pf-cli') f.cliId = el.value;
    else if (a === 'pf-cot') {
      f.cotId = el.value;
      const q = cotsAprob.find(x => x.id === f.cotId), cli = document.getElementById('af-cli');
      if (q) { f.cliId = q.cliente_id; if (q.dias) { f.dias = q.dias; recalcFin(); } }
      if (cli) { if (q) cli.value = q.cliente_id; cli.disabled = !!q; }
    }
    pintarPicker(el);
  }
  function accionPicker(a, id) {
    if (a === 'pf-q') { f.dias = Number(id); recalcFin(); }
    else if (a === 'pf-tog') { f.opts[id] = !f.opts[id]; recalcFin(); } // los días laborales pactados no cambian; cambia cuánto calendario ocupan
    else if (a === 'cal-modo') f.sel = id;
    else if (a === 'cal-mes') { if (Number(id) < 0) f.antes++; else f.despues++; }
    else if (a === 'cal-dia') {
      if (f.sel === 'ini') { f.ini = id; if (f.dias >= 1) recalcFin(); else if (f.fin < id) f.fin = id; f.sel = 'fin'; }
      else {
        if (f.ini && id < f.ini) { U.toast('El fin no puede ser anterior al inicio. Cambia primero “el inicio”.', 'err'); return; }
        f.fin = id; recalcDias();
      }
    }
    pintarPicker(null);
  }
  function iniciarPicker() { pintarPicker(null); const e = document.getElementById('pf-ini'); if (e) e.value = f.ini || ''; }
  function nuevoEstado(a, cotId) {
    const hoy = U.today();
    if (a) {
      f = { modo: 'editar', id: a.id, cotId: a.cotizacion_id || '', maqId: a.maquina_id || '', cliId: a.cliente_id, ini: a.fecha_inicio, fin: a.fecha_fin, opts: H.opcionesDe(a), novs: novs(a), sel: 'fin', antes: 0, despues: 0 };
      f.orig = { ini: f.ini, fin: f.fin, sab: f.opts.sab, dom: f.opts.dom, fest: f.opts.fest };
      recalcDias();
    } else {
      const q = cotId ? cotsAprob.find(x => x.id === cotId) : null;
      f = { modo: 'nuevo', cotId: q ? q.id : '', maqId: '', cliId: q ? q.cliente_id : (clientes[0] && clientes[0].id), ini: hoy, dias: (q && q.dias) || 15, opts: { sab: true, dom: true, fest: true }, novs: [], sel: 'fin', antes: 0, despues: 0 };
      recalcFin();
    }
  }
  function cambiosSinGuardar() {
    return !!(f && f.modo === 'editar' && f.orig && (f.ini !== f.orig.ini || f.fin !== f.orig.fin || f.opts.sab !== f.orig.sab || f.opts.dom !== f.orig.dom || f.opts.fest !== f.orig.fest));
  }
  function validarPeriodo() {
    if (!f.ini || !f.fin) throw new Error('Indica la fecha de inicio y de fin');
    if (f.fin < f.ini) throw new Error('La fecha fin no puede ser anterior al inicio');
    if (H.contar(f.ini, f.fin, null, f.opts).habiles < 1) throw new Error('El período debe tener al menos 1 día laboral');
  }
  function optsEquipo() {
    return '<option value="">— Asignar después —</option>' + maquinas.map(m => '<option value="' + esc(m.id) + '"' + (m.id === f.maqId ? ' selected' : '') + '>' +
      esc(etiquetaMaq(m) + (m.estado === 'varada' ? '  ⚠ VARADA' : '')) + '</option>').join('');
  }

  // ---------- Nuevo alquiler (sobre una cotización aprobada o suelto) ----------
  function formAlquiler(cotId) {
    if (!clientes.length) { U.toast('Primero crea un cliente', 'err'); return; }
    nuevoEstado(null, cotId);
    const libres = cotsLibres(), q = cotId ? cotsAprob.find(x => x.id === cotId) : null;
    U.openModal('<h3>🚀 Montar alquiler</h3><p class="vacio">Sobre una cotización aprobada: elige el inicio y los días laborales, la fecha fin se calcula sola. El equipo puede asignarse después.</p>' +
      '<label>Cotización aprobada<select id="af-cot" data-oninput="alq.pf-cot"><option value="">— Sin cotización —</option>' +
      libres.map(x => '<option value="' + esc(x.id) + '"' + (x.id === f.cotId ? ' selected' : '') + '>' + esc((x.upbq_clientes ? x.upbq_clientes.nombre : '—') + ' · ' + (x.equipo || 'equipo') + (x.dias ? ' · ' + x.dias + ' d' : '') + (x.valor != null ? ' · ' + money(x.valor) : '')) + '</option>').join('') + '</select></label>' +
      '<div id="af-cotinfo" class="mc-sig"></div>' +
      '<div class="row2"><label>Cliente<select id="af-cli" data-oninput="alq.pf-cli"' + (q ? ' disabled' : '') + '>' + clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === f.cliId ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('') + '</select></label>' +
      '<label>Equipo<select id="af-maq" data-oninput="alq.pf-maq">' + optsEquipo() + '</select></label></div>' +
      pickerHTML() + '<label>Notas<textarea id="af-notas" rows="2"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="alq.guardar-alq">Confirmar alquiler</button></div>');
    iniciarPicker();
  }
  async function guardarAlquiler() {
    validarPeriodo();
    const { error } = await U.sb.from('upbq_alquileres').insert({
      maquina_id: f.maqId || null, cliente_id: f.cliId, cotizacion_id: f.cotId || null, fecha_inicio: f.ini, fecha_fin: f.fin,
      notas: document.getElementById('af-notas').value.trim() || null, excluir_sabados: f.opts.sab, excluir_domingos: f.opts.dom, excluir_festivos: f.opts.fest
    });
    if (error) throw error;
    U.dirty.panel = U.dirty.cotizaciones = true;
    U.toast('Alquiler creado' + (f.maqId ? '' : ' · falta asignar equipo'));
    U.closeModal();
    if (!ini || f.ini < ini || f.ini > U.addDays(ini, DIAS_GANTT - 1)) ini = lunesDe(f.ini);
    f = null;
    await render();
  }

  // ---------- Detalle / edición ----------
  function detalle(id) {
    const a = alquileres.find(x => x.id === id);
    if (!a) return;
    detalleId = id;
    nuevoEstado(a);
    const hoy = U.today(), k = claveAlq(a, hoy), cot = a.upbq_cotizaciones;
    const nvs = novs(a).slice().sort((x, y) => x.fecha_desde < y.fecha_desde ? -1 : 1);
    const dnv = hoy < a.fecha_inicio ? a.fecha_inicio : hoy > a.fecha_fin ? a.fecha_fin : hoy;
    U.openModal('<h3>' + esc(refAlq(a)) + ' · ' + esc(nom(a)) + ' <span class="badge est-' + CSS[k] + '">' + esc(ETQ[k]) + '</span></h3>' +
      (cot ? '<div class="mc-sig">' + textoCot(cot) + '</div>' : '') +
      '<label>Equipo asignado <small>(se puede asignar aunque esté varado)</small><select id="ed-maq" data-oninput="alq.pf-maq">' + optsEquipo() + '</select></label>' +
      '<div class="subform"><div class="sf-t">Período del alquiler — editable</div>' + pickerHTML() + '</div>' +
      '<h4>Novedades (días no trabajados)</h4>' +
      (nvs.length ? nvs.map(n => '<div class="mini"><div>' + esc(fmt(n.fecha_desde)) + (n.fecha_hasta !== n.fecha_desde ? ' → ' + esc(fmt(n.fecha_hasta)) : '') + ' · <b>' + esc(n.motivo) + '</b>' + (n.nota ? ' · ' + esc(n.nota) : '') +
        '</div><button class="btn mini-b" data-action="alq.nov-del" data-id="' + esc(n.id) + '">Quitar</button></div>').join('') : '<p class="vacio">Sin novedades</p>') +
      '<div class="subform"><div class="row2"><label>Desde<input id="nv-desde" type="date" value="' + esc(dnv) + '"></label><label>Hasta<input id="nv-hasta" type="date" value="' + esc(dnv) + '"></label></div>' +
      '<label>Motivo<input id="nv-motivo" placeholder="Paro, lluvia, avería…"></label><label>Nota<input id="nv-nota"></label>' +
      '<div class="row end"><button class="btn" data-action="alq.nov-add" data-id="' + esc(id) + '">Registrar novedad</button></div></div>' +
      '<label>Notas<textarea id="ed-notas" rows="2">' + esc(a.notas || '') + '</textarea></label>' +
      '<div class="row wrap end"><button class="btn" data-action="modal.cerrar">Cerrar</button>' +
      (a.estado === 'activo' ? '<button class="btn ok" data-action="alq.finalizar" data-id="' + esc(id) + '">Finalizar alquiler</button>' : '<button class="btn" data-action="alq.reabrir" data-id="' + esc(id) + '">Reabrir</button>') +
      '<button class="btn primary" data-action="alq.guardar-ed" data-id="' + esc(id) + '">Guardar cambios</button></div>');
    iniciarPicker();
  }
  async function repintar(id) { await render(); detalle(id); } // lista Y modal de detalle

  async function guardarEdicion(id) {
    const a = alquileres.find(x => x.id === id);
    if (a.estado === 'activo') validarPeriodo(); else if (!f.fin || !f.ini || f.fin < f.ini) throw new Error('Fechas inválidas');
    const fuera = novs(a).find(n => n.fecha_desde < f.ini || n.fecha_hasta > f.fin);
    if (fuera) throw new Error('Hay una novedad (' + fuera.motivo + ') fuera de las nuevas fechas: quítala o ajústala primero');
    const { error } = await U.sb.from('upbq_alquileres').update({
      maquina_id: f.maqId || null, fecha_inicio: f.ini, fecha_fin: f.fin, excluir_sabados: f.opts.sab, excluir_domingos: f.opts.dom, excluir_festivos: f.opts.fest,
      notas: document.getElementById('ed-notas').value.trim() || null
    }).eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast('Alquiler actualizado');
    await repintar(id);
  }
  async function agregarNovedad(id) {
    if (cambiosSinGuardar()) throw new Error('Tienes cambios de fechas sin guardar: guarda primero (o cierra y vuelve a abrir)');
    const a = alquileres.find(x => x.id === id);
    const v = k => document.getElementById(k).value.trim();
    const row = { alquiler_id: id, fecha_desde: v('nv-desde'), fecha_hasta: v('nv-hasta'), motivo: v('nv-motivo'), nota: v('nv-nota') || null };
    if (!row.fecha_desde || !row.fecha_hasta) throw new Error('Indica desde y hasta');
    if (row.fecha_hasta < row.fecha_desde) throw new Error('“Hasta” no puede ser anterior a “Desde”');
    if (!row.motivo) throw new Error('El motivo es obligatorio');
    if (row.fecha_desde < a.fecha_inicio || row.fecha_hasta > a.fecha_fin) throw new Error('La novedad debe caer dentro del alquiler (' + fmt(a.fecha_inicio) + ' → ' + fmt(a.fecha_fin) + ')');
    const { error } = await U.sb.from('upbq_alquiler_novedades').insert(row);
    if (error) throw error;
    U.toast('Novedad registrada');
    await repintar(id);
  }
  async function quitarNovedad(novId) {
    const alq = detalleId;
    if (cambiosSinGuardar()) throw new Error('Tienes cambios de fechas sin guardar: guarda primero (o cierra y vuelve a abrir)');
    if (!(await U.confirmar('¿Quitar esta novedad? Los días volverán a contarse como trabajados.'))) return detalle(alq);
    const { error } = await U.sb.from('upbq_alquiler_novedades').delete().eq('id', novId);
    if (error) throw error;
    U.toast('Novedad eliminada');
    await repintar(alq);
  }
  async function cambiarEstado(id, estado, msg, pregunta) {
    if (pregunta && !(await U.confirmar(pregunta))) return detalle(id);
    const { error } = await U.sb.from('upbq_alquileres').update({ estado }).eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast(msg);
    await repintar(id);
  }

  function handle(a, id) {
    switch (a) {
      case 'vista': vista = id; return render();
      case 'filtro': filtro = id; return render();
      case 'nav': ini = Number(id) === 0 ? lunesDe(U.today()) : U.addDays(ini || lunesDe(U.today()), Number(id)); return render();
      case 'nuevo': case 'desde-cot': return formAlquiler(id);
      case 'guardar-alq': return guardarAlquiler();
      case 'ver': return detalle(id);
      case 'guardar-ed': return guardarEdicion(id);
      case 'nov-add': return agregarNovedad(id);
      case 'nov-del': return quitarNovedad(id);
      case 'finalizar': return cambiarEstado(id, 'finalizado', 'Alquiler finalizado', '¿Finalizar este alquiler? El equipo queda libre en el calendario.');
      case 'reabrir': return cambiarEstado(id, 'activo', 'Alquiler reabierto', null);
      case 'pf-q': case 'pf-tog': case 'cal-modo': case 'cal-mes': case 'cal-dia': return accionPicker(a, id);
    }
  }
  // formAlquiler necesita las listas cargadas: si se llega desde otra pestaña, render() ya las cargó.
  global.UPBQ.modulos.alq = { render, handle, handleInput };
})(window);
