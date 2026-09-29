(function (global) {
  'use strict';
  const U = global.UPBQ, E = global.UPBQ_EST.cotizacion;
  let lista = [], clientes = [], filtro = '';
  const cerrada = e => e === 'cerrada_ganada' || e === 'cerrada_perdida';

  async function cargar() {
    const [q, c] = await Promise.all([
      U.sb.from('upbq_cotizaciones').select('*, upbq_clientes(nombre)').order('fecha', { ascending: false }),
      U.sb.from('upbq_clientes').select('id,nombre').order('nombre')
    ]);
    if (q.error) throw q.error;
    if (c.error) throw c.error;
    lista = q.data; clientes = c.data;
  }
  async function render() {
    await cargar();
    const vis = filtro ? lista.filter(q => q.estado === filtro) : lista;
    const chips = ['<button class="chip' + (!filtro ? ' on' : '') + '" data-action="cot.filtro" data-id="">Todas (' + lista.length + ')</button>']
      .concat(Object.keys(E).map(k => '<button class="chip' + (filtro === k ? ' on' : '') + '" data-action="cot.filtro" data-id="' + k + '">' + esc(E[k]) + ' (' + lista.filter(q => q.estado === k).length + ')</button>')).join('');
    document.getElementById('vista').innerHTML = '<div class="head"><h2>Cotizaciones</h2><button class="btn primary" data-action="cot.nuevo">+ Cotización</button></div>' +
      '<div class="chips">' + chips + '</div>' +
      (vis.length ? '<div class="list">' + vis.map(q =>
        '<div class="item" data-action="cot.ver" data-id="' + esc(q.id) + '"><b>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + '</b>' +
        '<span class="badge ' + esc(q.estado) + '">' + esc(E[q.estado]) + '</span>' + (q.proforma_solicitada ? '<span class="badge proforma">Proforma</span>' : '') +
        '<small>' + U.fmtFecha(q.fecha) + ' · ' + esc(q.equipo || '—') + ' · ' + U.fmtMoney(q.valor) + '</small></div>').join('') + '</div>'
        : '<p class="vacio">Sin cotizaciones.</p>');
  }
  function form() {
    if (!clientes.length) { U.toast('Primero crea un cliente', 'err'); return; }
    U.openModal('<h3>Nueva cotización</h3>' +
      '<label>Cliente<select id="qf-cli">' + clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('') + '</select></label>' +
      '<label>Equipo<input id="qf-eq"></label><label>Valor<input id="qf-val" type="number" min="0" step="any"></label>' +
      '<label>Fecha<input id="qf-fecha" type="date" value="' + U.today() + '"></label>' +
      '<label>Estado<select id="qf-est">' + U.opts({ borrador: E.borrador, enviada: E.enviada }, 'enviada') + '</select></label>' +
      '<label>Notas<textarea id="qf-notas" rows="2"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="cot.guardar">Guardar</button></div>');
  }
  async function crearRecordatorio(q) {
    const hoy = U.today();
    const { error } = await U.sb.from('upbq_recordatorios').insert({
      cliente_id: q.cliente_id, cotizacion_id: q.id, auto: true,
      texto: 'Seguimiento de cotización' + (q.equipo ? ' (' + q.equipo + ')' : ''),
      fecha: U.addDays(hoy, global.UPBQ_SEGUIMIENTO_DIAS)
    });
    if (error) throw error;
  }
  async function guardar() {
    const v = k => document.getElementById(k).value.trim();
    const row = { cliente_id: v('qf-cli'), equipo: v('qf-eq') || null, valor: v('qf-val') === '' ? null : Number(v('qf-val')), fecha: v('qf-fecha'), estado: v('qf-est'), notas: v('qf-notas') || null };
    if (!row.fecha) throw new Error('La fecha es obligatoria');
    const { data, error } = await U.sb.from('upbq_cotizaciones').insert(row).select().single();
    if (error) throw error;
    if (row.estado === 'enviada') await crearRecordatorio(data);
    U.dirty.panel = U.dirty.clientes = true;
    U.toast('Cotización guardada' + (row.estado === 'enviada' ? ' · recordatorio creado' : ''));
    U.closeModal();
    await render();
  }
  function detalle(id) {
    const q = lista.find(x => x.id === id);
    if (!q) return;
    const cerr = cerrada(q.estado);
    U.openModal('<h3>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + ' <span class="badge ' + esc(q.estado) + '">' + esc(E[q.estado]) + '</span></h3>' +
      '<p>' + U.fmtFecha(q.fecha) + ' · ' + esc(q.equipo || '—') + ' · ' + U.fmtMoney(q.valor) + '</p>' + (q.notas ? '<p class="nota">' + esc(q.notas) + '</p>' : '') +
      '<p>Proforma: ' + (q.proforma_solicitada ? 'solicitada ' + U.fmtFecha(q.proforma_fecha) : 'no') + '</p>' +
      (cerr ? '<p><b>Cierre ' + U.fmtFecha(q.fecha_cierre) + ':</b> ' + esc(q.motivo_cierre) + '</p>' : '') +
      (cerr ? '' : '<div class="row wrap">' +
        (q.estado !== 'enviada' ? '<button class="btn" data-action="cot.estado" data-id="' + esc(id) + '" data-to="enviada">Marcar enviada</button>' : '') +
        (q.estado !== 'en_seguimiento' ? '<button class="btn" data-action="cot.estado" data-id="' + esc(id) + '" data-to="en_seguimiento">En seguimiento</button>' : '') +
        (q.proforma_solicitada ? '' : '<button class="btn" data-action="cot.proforma" data-id="' + esc(id) + '">Proforma solicitada</button>') +
        '<button class="btn ok" data-action="cot.cerrar" data-id="' + esc(id) + '" data-to="cerrada_ganada">Ganada</button>' +
        '<button class="btn danger" data-action="cot.cerrar" data-id="' + esc(id) + '" data-to="cerrada_perdida">Perdida</button></div>') +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cerrar</button></div>');
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
  function pedirCierre(id, to) {
    U.openModal('<h3>' + (to === 'cerrada_ganada' ? 'Cerrar como ganada' : 'Cerrar como perdida') + '</h3>' +
      '<label>Motivo (obligatorio)<textarea id="qc-motivo" rows="3"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="cot.ver" data-id="' + esc(id) + '">Volver</button><button class="btn primary" data-action="cot.confcierre" data-id="' + esc(id) + '" data-to="' + esc(to) + '">Confirmar cierre</button></div>');
  }
  async function confirmarCierre(id, to) {
    const motivo = document.getElementById('qc-motivo').value.trim();
    if (!motivo) throw new Error('El motivo de cierre es obligatorio');
    await actualizar(id, { estado: to, motivo_cierre: motivo, fecha_cierre: U.today() });
    // Cierra los recordatorios pendientes de esa cotización.
    const nuevo = to === 'cerrada_ganada' ? 'hecho' : 'negocio_cae';
    const { error } = await U.sb.from('upbq_recordatorios').update({ estado: nuevo }).eq('cotizacion_id', id).eq('estado', 'pendiente');
    if (error) throw error;
  }
  function handle(a, id, el) {
    switch (a) {
      case 'filtro': filtro = id; return render();
      case 'nuevo': return form();
      case 'guardar': return guardar();
      case 'ver': return detalle(id);
      case 'estado': return cambiarEstado(id, el.dataset.to);
      case 'proforma': return actualizar(id, { proforma_solicitada: true, proforma_fecha: U.today() });
      case 'cerrar': return pedirCierre(id, el.dataset.to);
      case 'confcierre': return confirmarCierre(id, el.dataset.to);
    }
  }
  global.UPBQ.modulos.cot = { render, handle };
})(window);
