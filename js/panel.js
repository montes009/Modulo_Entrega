(function (global) {
  'use strict';
  // Panel = la agenda: de un vistazo qué hay que hacer hoy (recordatorios), las notas rápidas (pendientes) y lo que se cae por los lados.
  const U = global.UPBQ, PR = global.UPBQ_EST.prioridad, fmt = U.fmtFecha, money = U.fmtMoney;
  const ORD = { alta: 0, media: 1, baja: 2 };
  const fDiaBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
  let verHechos = false, pens = [], recs = [], clientes = [];
  const refAlq = a => 'ALQ-' + (a.nro != null ? String(a.nro).padStart(4, '0') : String(a.id).slice(-4).toUpperCase());

  async function render() {
    const hoy = U.today();
    const [rec, cot, mora, pen, alq, res, maq, alqCot, cli] = await Promise.all([
      U.sb.from('upbq_recordatorios').select('*, upbq_clientes(nombre)').eq('estado', 'pendiente').lte('fecha', hoy).order('fecha'),
      U.sb.from('upbq_cotizaciones').select('*, upbq_clientes(nombre)').order('fecha'),
      U.sb.from('upbq_clientes').select('id,nombre,telefono').eq('estado', 'en_mora').order('nombre'),
      U.sb.from('upbq_pendientes').select('*').order('created_at'),
      U.sb.from('upbq_alquileres').select('*, upbq_clientes(nombre), upbq_maquinas(codigo,tipo)').eq('estado', 'activo').order('fecha_fin'),
      U.sb.from('upbq_negociaciones_resumen').select('*'),
      U.sb.from('upbq_maquinas').select('id,codigo,tipo,nota').eq('estado', 'varada').order('codigo'),
      U.sb.from('upbq_alquileres').select('cotizacion_id'),
      U.sb.from('upbq_clientes').select('id,nombre').order('nombre')
    ]);
    for (const r of [rec, cot, mora, pen, alq, res, maq, alqCot, cli]) if (r.error) throw r.error;
    pens = pen.data; recs = rec.data; clientes = cli.data;

    const abiertas = cot.data.filter(q => q.estado === 'enviada' || q.estado === 'en_seguimiento');
    const sinResp = abiertas.filter(q => U.diffDays(q.fecha, hoy) >= global.UPBQ_SIN_RESPUESTA_DIAS);
    const conAlq = new Set(alqCot.data.map(x => x.cotizacion_id).filter(Boolean));
    const porMontar = cot.data.filter(q => q.estado === 'cerrada_ganada' && !conAlq.has(q.id));
    const sem = U.addDays(hoy, 7);
    const arrancan = alq.data.filter(a => a.fecha_inicio >= hoy && a.fecha_inicio <= sem);
    const terminan = alq.data.filter(a => a.fecha_fin >= hoy && a.fecha_fin <= sem && a.fecha_inicio <= hoy);
    const vencidos = alq.data.filter(a => a.fecha_fin < hoy);
    const sinEquipo = alq.data.filter(a => !a.maquina_id && a.fecha_fin >= hoy);
    const abiertosCli = new Set(abiertas.map(q => q.cliente_id));
    const quietos = res.data.filter(h => h.mensajes && abiertosCli.has(h.cliente_id) && U.diffDays(fDiaBogota.format(new Date(h.ultima)), hoy) >= global.UPBQ_NEG_SIN_MOVIMIENTO_DIAS);
    const nomCli = id => { const q = cot.data.find(x => x.cliente_id === id); return q && q.upbq_clientes ? q.upbq_clientes.nombre : '—'; };

    const w = (titulo, n, cuerpo, extra) => '<section class="widget"><h3>' + esc(titulo) + ' <span class="count">' + n + '</span>' + (extra || '') + '</h3>' + cuerpo + '</section>';
    const vacio = t => '<p class="vacio">' + esc(t) + '</p>';
    const filaAlq = (a, txt) => '<div class="item" data-action="pan.ir-alq" data-id="' + esc(a.id) + '"><div><b>' + esc(a.upbq_clientes ? a.upbq_clientes.nombre : '—') + ' · ' + esc(a.upbq_maquinas ? a.upbq_maquinas.codigo : 'sin equipo') +
      '</b><small>' + esc(refAlq(a)) + ' · ' + txt + '</small></div></div>';

    // Recordatorios
    const wRec = w('Recordatorios de hoy y vencidos', rec.data.length, rec.data.length ? rec.data.map(r =>
      '<div class="item' + (r.fecha < hoy ? ' vencido' : '') + '"><div><b>' + esc(r.upbq_clientes ? r.upbq_clientes.nombre : 'General') + '</b><small>' + esc(fmt(r.fecha)) + ' · ' + esc(r.texto) + '</small></div>' +
      '<div class="row"><button class="btn ok mini-b" data-action="pan.rec" data-id="' + esc(r.id) + '" data-to="hecho">Hecho</button>' +
      '<button class="btn mini-b" data-action="pan.rec-pos" data-id="' + esc(r.id) + '">Posponer</button>' +
      (r.cotizacion_id ? '<button class="btn danger mini-b" data-action="pan.rec" data-id="' + esc(r.id) + '" data-to="negocio_cae">Negocio cae</button>' : '') + '</div></div>').join('') : vacio('Nada pendiente para hoy 🎉'),
      '<button class="btn mini-b der" data-action="pan.rec-nuevo">+ Recordatorio</button>');

    // Pendientes (notas rápidas)
    const abiertosP = pens.filter(p => !p.hecho).sort((a, b) => (ORD[a.prioridad] - ORD[b.prioridad]) || ((a.fecha || '9999') < (b.fecha || '9999') ? -1 : 1));
    const hechosP = pens.filter(p => p.hecho).reverse();
    const filaPen = p => '<div class="item pen ' + (p.hecho ? 'hecha' : '') + '"><div class="pen-txt"><b>' + esc(p.texto) + '</b><small>' +
      '<span class="dot p-' + esc(p.prioridad) + '" title="Prioridad ' + esc(PR[p.prioridad]) + '"></span>' + esc(PR[p.prioridad]) + (p.fecha ? ' · <span class="' + (!p.hecho && p.fecha < hoy ? 'rojo' : '') + '">' + esc(fmt(p.fecha)) + '</span>' : '') + '</small></div>' +
      '<div class="row">' + (p.hecho ? '<button class="btn mini-b" data-action="pan.pen-reab" data-id="' + esc(p.id) + '" title="Reabrir">↩</button>' : '<button class="btn ok mini-b" data-action="pan.pen-hecho" data-id="' + esc(p.id) + '" title="Hecho">✓</button>') +
      '<button class="btn mini-b" data-action="pan.pen-editar" data-id="' + esc(p.id) + '" title="Editar">✎</button><button class="btn mini-b" data-action="pan.pen-borrar" data-id="' + esc(p.id) + '" title="Borrar">🗑</button></div></div>';
    const wPen = w('Pendientes y notas rápidas', abiertosP.length,
      '<div class="pen-add"><input id="pen-texto" data-enter="pan.pen-nuevo" placeholder="Nota rápida o pendiente…"><input id="pen-fecha" type="date" title="Fecha (opcional)">' +
      '<select id="pen-prio">' + U.opts(PR, 'media') + '</select><button class="btn primary" data-action="pan.pen-nuevo">Añadir</button></div>' +
      (abiertosP.map(filaPen).join('') || vacio('Sin pendientes')) +
      (hechosP.length ? '<button class="btn mini-b" data-action="pan.pen-ver-hechos">' + (verHechos ? 'Ocultar' : 'Ver') + ' hechos (' + hechosP.length + ')</button>' + (verHechos ? hechosP.map(filaPen).join('') : '') : ''));

    document.getElementById('vista').innerHTML = '<div class="head"><h2>Hoy · ' + esc(fmt(hoy)) + '</h2></div><div class="grid">' + wRec + wPen +
      w('Aprobadas: montar alquiler', porMontar.length, porMontar.length ? porMontar.map(q =>
        '<div class="item"><div><b>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + '</b><small>' + esc((q.equipo || 'Equipo') + (q.dias ? ' · ' + q.dias + ' días' : '') + ' · ' + money(q.valor)) + '</small></div>' +
        '<button class="btn primary mini-b" data-action="pan.montar" data-id="' + esc(q.id) + '">🚀 Montar</button></div>').join('') : vacio('Ninguna pendiente de montar')) +
      w('Cotizaciones sin respuesta', sinResp.length, sinResp.length ? sinResp.map(q =>
        '<div class="item" data-action="cot.ver-desde-panel" data-id="' + esc(q.id) + '"><b>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + '</b><small>' + U.diffDays(q.fecha, hoy) + ' días · ' + esc(q.equipo || '—') + ' · ' + esc(money(q.valor)) + '</small></div>').join('') : vacio('Ninguna')) +
      w('Alquileres que arrancan (7 días)', arrancan.length, arrancan.length ? arrancan.map(a => filaAlq(a, 'Inicia ' + esc(fmt(a.fecha_inicio)))).join('') : vacio('Ninguno')) +
      w('Alquileres que terminan (7 días)', terminan.length, terminan.length ? terminan.map(a => filaAlq(a, 'Termina ' + esc(fmt(a.fecha_fin)) + ' · ' + U.diffDays(hoy, a.fecha_fin) + ' d')).join('') : vacio('Ninguno')) +
      (vencidos.length ? w('Alquileres vencidos sin finalizar', vencidos.length, vencidos.map(a => filaAlq(a, 'Terminó ' + esc(fmt(a.fecha_fin)))).join('')) : '') +
      (sinEquipo.length ? w('Alquileres sin equipo asignado', sinEquipo.length, sinEquipo.map(a => filaAlq(a, 'Inicia ' + esc(fmt(a.fecha_inicio)))).join('')) : '') +
      w('Equipos varados', maq.data.length, maq.data.length ? maq.data.map(m => '<div class="item" data-action="pan.ir-maq"><div><b>' + esc(m.codigo) + '</b><small>' + esc((m.tipo || '') + (m.nota ? ' · ' + m.nota : '')) + '</small></div></div>').join('') : vacio('Todos los equipos disponibles')) +
      w('Clientes en mora', mora.data.length, mora.data.length ? mora.data.map(c => '<div class="item est-en_mora" data-action="pan.ir-cli" data-id="' + esc(c.id) + '"><b>' + esc(c.nombre) + '</b><small>' + esc(c.telefono || '') + '</small></div>').join('') : vacio('Ninguno')) +
      w('Negociaciones sin movimiento', quietos.length, quietos.length ? quietos.map(h => '<div class="item" data-action="pan.ir-neg" data-id="' + esc(h.cliente_id) + '"><div><b>' + esc(nomCli(h.cliente_id)) + '</b><small>Último mensaje ' + esc(fmt(fDiaBogota.format(new Date(h.ultima)))) + ' · cotización abierta</small></div></div>').join('') : vacio('Todas al día')) +
      '</div>';
  }

  // ---------- Recordatorios ----------
  function formRecordatorio() {
    U.openModal('<h3>Nuevo recordatorio</h3><label>¿Qué hay que recordar?<textarea id="rf-texto" rows="2" placeholder="Llamar a…, enviar proforma a…"></textarea></label>' +
      '<div class="row2"><label>Fecha<input id="rf-fecha" type="date" value="' + esc(U.today()) + '"></label>' +
      '<label>Cliente <small>(opcional)</small><select id="rf-cli"><option value="">— General —</option>' + clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('') + '</select></label></div>' +
      '<div class="quick"><span class="lbl">Rápido:</span>' + [['Hoy', 0], ['Mañana', 1], ['+3 días', 3], ['+1 semana', 7]].map(x => '<button class="btn mini-b" data-action="pan.rf-q" data-id="' + x[1] + '">' + x[0] + '</button>').join('') + '</div>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="pan.rec-guardar">Guardar</button></div>');
  }
  async function guardarRecordatorio() {
    const texto = document.getElementById('rf-texto').value.trim(), fecha = document.getElementById('rf-fecha').value;
    if (!texto) throw new Error('Escribe qué hay que recordar');
    if (!fecha) throw new Error('Indica la fecha');
    const { error } = await U.sb.from('upbq_recordatorios').insert({ texto, fecha, cliente_id: document.getElementById('rf-cli').value || null });
    if (error) throw error;
    U.toast('Recordatorio creado');
    U.closeModal();
    await render();
  }
  function formPosponer(id) {
    const r = recs.find(x => x.id === id);
    U.openModal('<h3>Posponer recordatorio</h3><p class="vacio">' + esc(r ? r.texto : '') + '</p>' +
      '<div class="quick"><span class="lbl">Para:</span>' + [['Mañana', 1], ['+3 días', 3], ['+1 semana', 7], ['+2 semanas', 14]].map(x => '<button class="btn mini-b" data-action="pan.pos-q" data-id="' + esc(id) + '" data-n="' + x[1] + '">' + x[0] + '</button>').join('') + '</div>' +
      '<label>…o una fecha<input id="rp-fecha" type="date" value="' + esc(U.addDays(U.today(), 1)) + '"></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="pan.pos-ok" data-id="' + esc(id) + '">Guardar fecha</button></div>');
  }
  async function posponer(id, fecha) {
    if (!fecha) throw new Error('Indica la nueva fecha');
    const { error } = await U.sb.from('upbq_recordatorios').update({ fecha }).eq('id', id);
    if (error) throw error;
    U.toast('Pospuesto para ' + fmt(fecha));
    U.closeModal();
    await render();
  }

  // ---------- Pendientes ----------
  function formPendiente(id) {
    const p = pens.find(x => x.id === id);
    if (!p) return;
    U.openModal('<h3>Editar pendiente</h3><label>Texto<textarea id="pf-texto" rows="2">' + esc(p.texto) + '</textarea></label>' +
      '<div class="row2"><label>Fecha <small>(opcional)</small><input id="pf-fecha" type="date" value="' + esc(p.fecha || '') + '"></label><label>Prioridad<select id="pf-prio">' + U.opts(PR, p.prioridad) + '</select></label></div>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="pan.pen-guardar" data-id="' + esc(id) + '">Guardar</button></div>');
  }
  async function actualizarPen(id, cambios, msg) {
    const { error } = await U.sb.from('upbq_pendientes').update(cambios).eq('id', id);
    if (error) throw error;
    if (msg) U.toast(msg);
    U.closeModal();
    await render();
  }

  async function handle(a, id, el) {
    switch (a) {
      case 'rec': return actualizarRec(id, el.dataset.to);
      case 'rec-nuevo': return formRecordatorio();
      case 'rec-guardar': return guardarRecordatorio();
      case 'rf-q': document.getElementById('rf-fecha').value = U.addDays(U.today(), Number(id)); return;
      case 'rec-pos': return formPosponer(id);
      case 'pos-q': return posponer(id, U.addDays(U.today(), Number(el.dataset.n)));
      case 'pos-ok': return posponer(id, document.getElementById('rp-fecha').value);
      case 'pen-nuevo': {
        const t = document.getElementById('pen-texto').value.trim();
        if (!t) throw new Error('Escribe el pendiente');
        const { error } = await U.sb.from('upbq_pendientes').insert({ texto: t, fecha: document.getElementById('pen-fecha').value || null, prioridad: document.getElementById('pen-prio').value });
        if (error) throw error;
        return render();
      }
      case 'pen-hecho': return actualizarPen(id, { hecho: true });
      case 'pen-reab': return actualizarPen(id, { hecho: false });
      case 'pen-editar': return formPendiente(id);
      case 'pen-guardar': {
        const texto = document.getElementById('pf-texto').value.trim();
        if (!texto) throw new Error('El texto no puede quedar vacío');
        return actualizarPen(id, { texto, fecha: document.getElementById('pf-fecha').value || null, prioridad: document.getElementById('pf-prio').value }, 'Pendiente actualizado');
      }
      case 'pen-borrar': {
        if (!(await U.confirmar('¿Borrar este pendiente?'))) return;
        const { error } = await U.sb.from('upbq_pendientes').delete().eq('id', id);
        if (error) throw error;
        U.toast('Pendiente borrado');
        return render();
      }
      case 'pen-ver-hechos': verHechos = !verHechos; return render();
      case 'montar': await U.irA('alq'); return U.modulos.alq.handle('desde-cot', id);
      case 'ir-alq': await U.irA('alq'); return U.modulos.alq.handle('ver', id);
      case 'ir-maq': return U.irA('maq');
      case 'ir-cli': await U.irA('cli'); return U.modulos.cli.handle('ver', id);
      case 'ir-neg': await U.irA('neg'); return U.modulos.neg.handle('abrir', id);
    }
  }
  async function actualizarRec(id, to) {
    const { error } = await U.sb.from('upbq_recordatorios').update({ estado: to }).eq('id', id);
    if (error) throw error;
    U.toast('Recordatorio actualizado');
    return render();
  }
  global.UPBQ.modulos.pan = { render, handle };
})(window);
