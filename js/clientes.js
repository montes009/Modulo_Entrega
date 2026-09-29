(function (global) {
  'use strict';
  const U = global.UPBQ, E = global.UPBQ_EST.cliente;
  let lista = [], filtro = '', detalleId = null;

  async function cargar() {
    const { data, error } = await U.sb.from('upbq_clientes').select('*').order('nombre');
    if (error) throw error;
    lista = data;
  }
  async function render() {
    await cargar();
    const cont = document.getElementById('vista');
    const vis = filtro ? lista.filter(c => c.estado === filtro) : lista;
    const chips = ['<button class="chip' + (!filtro ? ' on' : '') + '" data-action="cli.filtro" data-id="">Todos (' + lista.length + ')</button>']
      .concat(Object.keys(E).map(k => '<button class="chip' + (filtro === k ? ' on' : '') + '" data-action="cli.filtro" data-id="' + k + '">' + esc(E[k]) + ' (' + lista.filter(c => c.estado === k).length + ')</button>')).join('');
    cont.innerHTML = '<div class="head"><h2>Clientes</h2><button class="btn primary" data-action="cli.nuevo">+ Cliente</button></div>' +
      '<div class="chips">' + chips + '</div>' +
      (vis.length ? '<div class="list">' + vis.map(c =>
        '<div class="item est-' + esc(c.estado) + '" data-action="cli.ver" data-id="' + esc(c.id) + '"><b>' + esc(c.nombre) + '</b><span class="badge ' + esc(c.estado) + '">' + esc(E[c.estado]) + '</span><small>' + esc(c.telefono || c.email || '') + '</small></div>').join('') + '</div>'
        : '<p class="vacio">Sin clientes' + (filtro ? ' en este estado' : ' todavía') + '.</p>');
  }
  function form(c) {
    c = c || {};
    U.openModal('<h3>' + (c.id ? 'Editar cliente' : 'Nuevo cliente') + '</h3>' +
      '<label>Nombre<input id="cf-nombre" value="' + esc(c.nombre) + '"></label>' +
      '<label>Teléfono<input id="cf-tel" value="' + esc(c.telefono) + '"></label>' +
      '<label>Email<input id="cf-email" value="' + esc(c.email) + '"></label>' +
      '<label>Estado<select id="cf-estado">' + U.opts(E, c.estado || 'prospecto') + '</select></label>' +
      '<label>Notas<textarea id="cf-notas" rows="3">' + esc(c.notas) + '</textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="cli.guardar" data-id="' + esc(c.id || '') + '">Guardar</button></div>');
  }
  async function guardar(id) {
    const v = k => document.getElementById(k).value.trim();
    const row = { nombre: v('cf-nombre'), telefono: v('cf-tel') || null, email: v('cf-email') || null, estado: v('cf-estado'), notas: v('cf-notas') || null };
    if (!row.nombre) throw new Error('El nombre es obligatorio');
    const q = id ? U.sb.from('upbq_clientes').update(row).eq('id', id) : U.sb.from('upbq_clientes').insert(row);
    const { error } = await q;
    if (error) throw error;
    U.dirty.panel = U.dirty.cotizaciones = true;
    U.toast('Cliente guardado');
    await render();
    if (id && detalleId === id) await ver(id); else U.closeModal();
  }
  async function ver(id) {
    detalleId = id;
    const c = lista.find(x => x.id === id);
    if (!c) return;
    const [cot, rec] = await Promise.all([
      U.sb.from('upbq_cotizaciones').select('*').eq('cliente_id', id).order('fecha', { ascending: false }),
      U.sb.from('upbq_recordatorios').select('*').eq('cliente_id', id).order('fecha', { ascending: false }).limit(20)
    ]);
    if (cot.error) throw cot.error;
    if (rec.error) throw rec.error;
    const CE = global.UPBQ_EST.cotizacion, RE = global.UPBQ_EST.recordatorio;
    U.openModal('<h3>' + esc(c.nombre) + ' <span class="badge ' + esc(c.estado) + '">' + esc(E[c.estado]) + '</span></h3>' +
      '<p>' + esc(c.telefono || '') + ' ' + esc(c.email || '') + '</p>' + (c.notas ? '<p class="nota">' + esc(c.notas) + '</p>' : '') +
      '<h4>Cotizaciones</h4>' + (cot.data.length ? cot.data.map(q => '<div class="mini">' + U.fmtFecha(q.fecha) + ' · ' + esc(q.equipo || '—') + ' · ' + U.fmtMoney(q.valor) + ' · ' + esc(CE[q.estado]) + '</div>').join('') : '<p class="vacio">Ninguna</p>') +
      '<h4>Recordatorios</h4>' + (rec.data.length ? rec.data.map(r => '<div class="mini">' + U.fmtFecha(r.fecha) + ' · ' + esc(r.texto) + ' · ' + esc(RE[r.estado]) + '</div>').join('') : '<p class="vacio">Ninguno</p>') +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cerrar</button><button class="btn" data-action="cli.hilo" data-id="' + esc(id) + '">Ver negociación</button><button class="btn" data-action="cli.editar" data-id="' + esc(id) + '">Editar</button></div>');
  }
  async function handle(a, id) {
    switch (a) {
      case 'filtro': filtro = id; return render();
      case 'nuevo': return form();
      case 'editar': return form(lista.find(x => x.id === id));
      case 'guardar': return guardar(id);
      case 'ver': return ver(id);
      case 'hilo': U.closeModal(); await U.irA('neg'); return U.modulos.neg.handle('abrir', id);
    }
  }
  global.UPBQ.modulos.cli = { render, handle, get lista() { return lista; } };
  global.UPBQ.modulos.cli.cargar = cargar;
})(window);
