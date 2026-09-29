(function (global) {
  'use strict';
  // Cotizaciones = la nota comercial: "el cliente X pidió un brazo por 15 días, valor $Y".
  // Cuando el cliente la APRUEBA (estado cerrada_ganada) se monta el alquiler sobre ella (pestaña Alquileres).
  const U = global.UPBQ, E = global.UPBQ_EST.cotizacion, fmt = U.fmtFecha, money = U.fmtMoney;
  let lista = [], clientes = [], alqPorCot = new Map(), filtro = '';
  const cerrada = e => e === 'cerrada_ganada' || e === 'cerrada_perdida';
  const refAlq = a => 'ALQ-' + (a.nro != null ? String(a.nro).padStart(4, '0') : String(a.id).slice(-4).toUpperCase());
  const porMontar = q => q.estado === 'cerrada_ganada' && !alqPorCot.has(q.id);

  async function cargar() {
    const [q, c, a] = await Promise.all([
      U.sb.from('upbq_cotizaciones').select('*, upbq_clientes(nombre)').order('fecha', { ascending: false }),
      U.sb.from('upbq_clientes').select('id,nombre').order('nombre'),
      U.sb.from('upbq_alquileres').select('id,nro,cotizacion_id,fecha_inicio,fecha_fin,estado')
    ]);
    for (const r of [q, c, a]) if (r.error) throw r.error;
    lista = q.data; clientes = c.data;
    alqPorCot = new Map(a.data.filter(x => x.cotizacion_id).map(x => [x.cotizacion_id, x]));
  }
  function resumen(q) {
    return [fmt(q.fecha), q.equipo || '—', q.dias ? q.dias + ' días' : null, money(q.valor)].filter(Boolean).join(' · ');
  }
  async function render() {
    await cargar();
    const cnt = k => k === 'por_montar' ? lista.filter(porMontar).length : lista.filter(q => q.estado === k).length;
    const vis = !filtro ? lista : filtro === 'por_montar' ? lista.filter(porMontar) : lista.filter(q => q.estado === filtro);
    const chip = (k, l) => '<button class="chip' + (filtro === k ? ' on' : '') + '" data-action="cot.filtro" data-id="' + k + '">' + esc(l) + ' (' + (k ? cnt(k) : lista.length) + ')</button>';
    const chips = chip('', 'Todas') + chip('por_montar', '🚀 Aprobadas sin alquiler') + Object.keys(E).map(k => chip(k, E[k])).join('');
    document.getElementById('vista').innerHTML = '<div class="head"><h2>Cotizaciones</h2><button class="btn primary" data-action="cot.nuevo">+ Cotización</button></div>' +
      '<div class="chips">' + chips + '</div>' +
      (vis.length ? '<div class="list">' + vis.map(q => {
        const alq = alqPorCot.get(q.id);
        return '<div class="item" data-action="cot.ver" data-id="' + esc(q.id) + '"><b>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + '</b>' +
          '<span class="bgs"><span class="badge ' + esc(q.estado) + '">' + esc(E[q.estado]) + '</span>' + (q.proforma_solicitada ? '<span class="badge proforma">Proforma</span>' : '') +
          (porMontar(q) ? '<span class="badge por-montar">Montar alquiler</span>' : '') + (alq ? '<span class="badge alq-ok">' + esc(refAlq(alq)) + '</span>' : '') + '</span>' +
          '<small>' + esc(resumen(q)) + '</small></div>';
      }).join('') + '</div>' : '<p class="vacio">Sin cotizaciones' + (filtro ? ' en este filtro' : ' todavía') + '.</p>');
  }

  // ---------- Crear / editar ----------
  function form(q) {
    if (!clientes.length) { U.toast('Primero crea un cliente', 'err'); return; }
    q = q || {};
    const nuevo = !q.id;
    U.openModal('<h3>' + (nuevo ? 'Nueva cotización' : 'Editar cotización') + '</h3>' +
      '<label>Cliente<select id="qf-cli">' + clientes.map(c => '<option value="' + esc(c.id) + '"' + (c.id === q.cliente_id ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('') + '</select></label>' +
      '<label>Equipo solicitado<input id="qf-eq" value="' + esc(q.equipo) + '" placeholder="p. ej. Brazo hidráulico"></label>' +
      '<div class="row2"><label>Días solicitados<input id="qf-dias" type="number" min="1" step="1" value="' + esc(q.dias || '') + '" placeholder="15"></label>' +
      '<label>Valor<input id="qf-val" type="number" min="0" step="any" value="' + esc(q.valor == null ? '' : q.valor) + '"></label></div>' +
      '<label>Fecha<input id="qf-fecha" type="date" value="' + esc(q.fecha || U.today()) + '"></label>' +
      (nuevo ? '<label>Estado<select id="qf-est">' + U.opts({ borrador: E.borrador, enviada: E.enviada }, 'enviada') + '</select></label>' : '') +
      '<label>Notas<textarea id="qf-notas" rows="2">' + esc(q.notas) + '</textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="cot.guardar" data-id="' + esc(q.id || '') + '">Guardar</button></div>');
  }
  async function crearRecordatorio(q) {
    const { error } = await U.sb.from('upbq_recordatorios').insert({
      cliente_id: q.cliente_id, cotizacion_id: q.id, auto: true,
      texto: 'Seguimiento de cotización' + (q.equipo ? ' (' + q.equipo + ')' : ''),
      fecha: U.addDays(U.today(), global.UPBQ_SEGUIMIENTO_DIAS)
    });
    if (error) throw error;
  }
  async function guardar(id) {
    const v = k => document.getElementById(k).value.trim();
    const row = { cliente_id: v('qf-cli'), equipo: v('qf-eq') || null, dias: v('qf-dias') === '' ? null : Math.floor(Number(v('qf-dias'))), valor: v('qf-val') === '' ? null : Number(v('qf-val')), fecha: v('qf-fecha'), notas: v('qf-notas') || null };
    if (!row.fecha) throw new Error('La fecha es obligatoria');
    if (row.dias != null && !(row.dias >= 1)) throw new Error('Los días deben ser 1 o más');
    if (id) {
      const { error } = await U.sb.from('upbq_cotizaciones').update(row).eq('id', id);
      if (error) throw error;
      U.dirty.panel = true;
      U.toast('Cotización actualizada');
      await render();
      return detalle(id);
    }
    row.estado = v('qf-est');
    const { data, error } = await U.sb.from('upbq_cotizaciones').insert(row).select().single();
    if (error) throw error;
    if (row.estado === 'enviada') await crearRecordatorio(data);
    U.dirty.panel = true;
    U.toast('Cotización guardada' + (row.estado === 'enviada' ? ' · recordatorio de seguimiento creado' : ''));
    U.closeModal();
    await render();
  }

  // ---------- Detalle ----------
  function detalle(id) {
    const q = lista.find(x => x.id === id);
    if (!q) return;
    const alq = alqPorCot.get(id), cerr = cerrada(q.estado);
    let acciones = '';
    if (!cerr) {
      acciones = '<div class="row wrap">' +
        (q.estado !== 'enviada' ? '<button class="btn" data-action="cot.estado" data-id="' + esc(id) + '" data-to="enviada">Marcar enviada</button>' : '') +
        (q.estado !== 'en_seguimiento' ? '<button class="btn" data-action="cot.estado" data-id="' + esc(id) + '" data-to="en_seguimiento">En seguimiento</button>' : '') +
        (q.proforma_solicitada ? '' : '<button class="btn" data-action="cot.proforma" data-id="' + esc(id) + '">Proforma solicitada</button>') +
        '<button class="btn ok" data-action="cot.aprobar" data-id="' + esc(id) + '">✅ Aprobada</button>' +
        '<button class="btn danger" data-action="cot.noaprobar" data-id="' + esc(id) + '">❌ No aprobada</button></div>';
    } else if (q.estado === 'cerrada_ganada') {
      acciones = alq
        ? '<div class="aviso amb">Alquiler montado: <b>' + esc(refAlq(alq)) + '</b> · ' + esc(fmt(alq.fecha_inicio)) + ' → ' + esc(fmt(alq.fecha_fin)) + ' <button class="btn mini-b" data-action="cot.ver-alq" data-id="' + esc(alq.id) + '">Ver alquiler</button></div>'
        : '<div class="row"><button class="btn primary" data-action="cot.montar" data-id="' + esc(id) + '">🚀 Montar alquiler</button></div>';
    }
    U.openModal('<h3>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + ' <span class="badge ' + esc(q.estado) + '">' + esc(E[q.estado]) + '</span></h3>' +
      '<div class="info"><div><small>Equipo solicitado</small><b>' + esc(q.equipo || '—') + '</b></div><div><small>Días · Valor</small><b>' + esc((q.dias ? q.dias + ' días' : '—') + ' · ' + money(q.valor)) + '</b></div></div>' +
      '<p>Fecha: ' + esc(fmt(q.fecha)) + ' · Proforma: ' + (q.proforma_solicitada ? 'solicitada ' + esc(fmt(q.proforma_fecha)) : 'no') + '</p>' + (q.notas ? '<p class="nota">' + esc(q.notas) + '</p>' : '') +
      (cerr ? '<p><b>Cierre ' + esc(fmt(q.fecha_cierre)) + ':</b> ' + esc(q.motivo_cierre) + '</p>' : '') + acciones +
      '<div class="row wrap end"><button class="btn" data-action="modal.cerrar">Cerrar</button>' + (cerr ? '<button class="btn" data-action="cot.reabrir" data-id="' + esc(id) + '">Reabrir</button>' : '') +
      '<button class="btn" data-action="cot.editar" data-id="' + esc(id) + '">Editar</button></div>');
  }
  async function actualizar(id, cambios) {
    const { error } = await U.sb.from('upbq_cotizaciones').update(cambios).eq('id', id);
    if (error) throw error;
    U.dirty.panel = U.dirty.clientes = true;
    await render();
    detalle(id); // re-pinta el modal de detalle, no solo la lista
  }
  async function cambiarEstado(id, to) {
    await actualizar(id, { estado: to });
    if (to === 'enviada') { await crearRecordatorio(lista.find(x => x.id === id)); U.toast('Recordatorio de seguimiento creado'); }
  }
  function pedirAprobacion(id) {
    U.openModal('<h3>✅ Cotización aprobada</h3><p class="vacio">El cliente aprobó. Puedes dejar una nota (opcional) y montar el alquiler sobre esta cotización.</p>' +
      '<label>Nota <small>(opcional)</small><textarea id="qa-nota" rows="2" placeholder="Aprobada por correo / llamada…"></textarea></label>' +
      '<div class="row wrap end"><button class="btn" data-action="cot.ver" data-id="' + esc(id) + '">Volver</button><button class="btn" data-action="cot.conf-aprobar" data-id="' + esc(id) + '" data-montar="0">Solo aprobar</button>' +
      '<button class="btn primary" data-action="cot.conf-aprobar" data-id="' + esc(id) + '" data-montar="1">Aprobar y montar alquiler</button></div>');
  }
  async function confirmarAprobacion(id, montar) {
    const nota = document.getElementById('qa-nota').value.trim();
    const { error } = await U.sb.from('upbq_cotizaciones').update({ estado: 'cerrada_ganada', motivo_cierre: nota || 'Aprobada por el cliente', fecha_cierre: U.today() }).eq('id', id);
    if (error) throw error;
    const r = await U.sb.from('upbq_recordatorios').update({ estado: 'hecho' }).eq('cotizacion_id', id).eq('estado', 'pendiente');
    if (r.error) throw r.error;
    U.dirty.panel = true;
    U.toast('Cotización aprobada');
    if (montar) return montarAlquiler(id);
    await render();
    detalle(id);
  }
  function pedirRechazo(id) {
    U.openModal('<h3>❌ Cotización no aprobada</h3><label>Motivo (obligatorio)<textarea id="qc-motivo" rows="3" placeholder="Precio, eligió a otro, obra cancelada…"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="cot.ver" data-id="' + esc(id) + '">Volver</button><button class="btn danger" data-action="cot.conf-rechazo" data-id="' + esc(id) + '">Confirmar</button></div>');
  }
  async function confirmarRechazo(id) {
    const motivo = document.getElementById('qc-motivo').value.trim();
    if (!motivo) throw new Error('El motivo es obligatorio');
    await actualizar(id, { estado: 'cerrada_perdida', motivo_cierre: motivo, fecha_cierre: U.today() });
    const { error } = await U.sb.from('upbq_recordatorios').update({ estado: 'negocio_cae' }).eq('cotizacion_id', id).eq('estado', 'pendiente');
    if (error) throw error;
  }
  async function montarAlquiler(id) {
    U.closeModal();
    await U.irA('alq');
    return U.modulos.alq.handle('desde-cot', id);
  }

  function handle(a, id, el) {
    switch (a) {
      case 'filtro': filtro = id; return render();
      case 'nuevo': return form();
      case 'editar': return form(lista.find(x => x.id === id));
      case 'guardar': return guardar(id);
      case 'ver': return detalle(id);
      case 'estado': return cambiarEstado(id, el.dataset.to);
      case 'proforma': return actualizar(id, { proforma_solicitada: true, proforma_fecha: U.today() });
      case 'aprobar': return pedirAprobacion(id);
      case 'conf-aprobar': return confirmarAprobacion(id, el.dataset.montar === '1');
      case 'noaprobar': return pedirRechazo(id);
      case 'conf-rechazo': return confirmarRechazo(id);
      case 'reabrir': return actualizar(id, { estado: 'en_seguimiento', motivo_cierre: null, fecha_cierre: null });
      case 'montar': return montarAlquiler(id);
      case 'ver-alq': U.closeModal(); return U.irA('alq').then(() => U.modulos.alq.handle('ver', id));
    }
  }
  global.UPBQ.modulos.cot = { render, handle };
})(window);
