(function (global) {
  'use strict';
  // Cuadro de máquinas: SOLO la visual de los equipos disponibles y varados. El estado se cambia libremente (un clic) y
  // lleva una nota rápida. No decide nada sobre los alquileres: un equipo varado se puede asignar igual (solo se avisa).
  const U = global.UPBQ, fmt = U.fmtFecha, EST = global.UPBQ_EST.maquina;
  let maquinas = [], alquileres = [], filtro = '';

  async function cargar() {
    const [m, a] = await Promise.all([
      U.sb.from('upbq_maquinas').select('*').order('codigo'),
      U.sb.from('upbq_alquileres').select('id,maquina_id,fecha_inicio,fecha_fin,estado,upbq_clientes(nombre)').eq('estado', 'activo').order('fecha_inicio')
    ]);
    for (const r of [m, a]) if (r.error) throw r.error;
    maquinas = m.data; alquileres = a.data;
  }
  function cli(a) { return a.upbq_clientes ? a.upbq_clientes.nombre : '—'; }
  function infoAlquiler(m, hoy) {
    const mias = alquileres.filter(a => a.maquina_id === m.id);
    const actual = mias.find(a => a.fecha_inicio <= hoy && a.fecha_fin >= hoy), prox = mias.find(a => a.fecha_inicio > hoy);
    if (actual) return { actual, html: '<div class="mc-sig">En alquiler: <b>' + esc(cli(actual)) + '</b> · hasta ' + esc(fmt(actual.fecha_fin)) + '</div>' };
    if (prox) return { actual: null, html: '<div class="mc-sig">Próximo alquiler: <b>' + esc(cli(prox)) + '</b> · desde ' + esc(fmt(prox.fecha_inicio)) + '</div>' };
    return { actual: null, html: '<div class="mc-sig">Sin alquiler asignado</div>' };
  }
  function tarjeta(m, hoy) {
    const varada = m.estado === 'varada', inf = infoAlquiler(m, hoy);
    return '<div class="mcard ' + (varada ? 'varada' : 'libre') + '" data-action="maq.editar" data-id="' + esc(m.id) + '">' +
      '<div class="mc-top"><div><div class="mc-id">' + esc(m.codigo) + '</div><div class="mc-tipo">' + esc(m.tipo || '') + '</div></div>' +
      '<span class="badge est-' + (varada ? 'varada' : 'libre') + '">' + esc(EST[m.estado] || m.estado) + '</span></div>' +
      '<div class="mc-body">' + (m.nota ? '<div class="mc-nota">📝 ' + esc(m.nota) + '</div>' : '') + inf.html +
      (varada && inf.actual ? '<div class="mc-alerta">⚠ Varada con un alquiler en curso</div>' : '') + '</div>' +
      '<div class="mc-foot"><button class="btn mini-b" data-action="maq.toggle" data-id="' + esc(m.id) + '">' + (varada ? '✅ Marcar disponible' : '⛔ Marcar varada') + '</button>' +
      '<button class="btn mini-b" data-action="maq.editar" data-id="' + esc(m.id) + '">Editar / nota</button></div></div>';
  }
  async function render() {
    await cargar();
    const hoy = U.today(), disp = maquinas.filter(m => m.estado !== 'varada').length, var_ = maquinas.length - disp;
    const kpi = (v, l, c) => '<div><b class="' + c + '">' + v + '</b><small>' + l + '</small></div>';
    const chip = (k, l, n) => '<button class="chip' + (filtro === k ? ' on' : '') + '" data-action="maq.filtro" data-id="' + k + '">' + l + ' (' + n + ')</button>';
    const lista = maquinas.filter(m => !filtro || m.estado === filtro);
    document.getElementById('vista').innerHTML = '<div class="head"><h2>Máquinas</h2><button class="btn primary" data-action="maq.nueva">+ Máquina</button></div>' +
      '<p class="vacio">Tablero de equipos disponibles y varados. Cambia el estado con un clic; las fechas y clientes se manejan en Alquileres.</p>' +
      '<div class="kpis kpis-top">' + kpi(maquinas.length, 'Equipos', '') + kpi(disp, 'Disponibles', 'v-ok') + kpi(var_, 'Varadas', 'v-bad') + '</div>' +
      '<div class="chips">' + chip('', 'Todas', maquinas.length) + chip('disponible', 'Disponibles', disp) + chip('varada', 'Varadas', var_) + '</div>' +
      (lista.length ? '<div class="mgrid">' + lista.map(m => tarjeta(m, hoy)).join('') + '</div>' : '<p class="vacio">' + (maquinas.length ? 'Nada en este filtro.' : 'Aún no hay máquinas. Crea la primera con “+ Máquina”.') + '</p>');
  }

  function form(m) {
    m = m || {};
    U.openModal('<h3>' + (m.id ? 'Editar máquina' : 'Nueva máquina') + '</h3>' +
      '<div class="row2"><label>Código / identificación<input id="mf-cod" value="' + esc(m.codigo) + '"></label><label>Tipo<input id="mf-tipo" value="' + esc(m.tipo) + '" placeholder="Grúa, retroexcavadora…"></label></div>' +
      '<label>Estado<select id="mf-est">' + U.opts(EST, m.estado || 'disponible') + '</select></label>' +
      '<label>Nota rápida <small>(por qué está varada, mantenimiento, ubicación…)</small><textarea id="mf-nota" rows="2">' + esc(m.nota) + '</textarea></label>' +
      '<label>Descripción<textarea id="mf-desc" rows="2">' + esc(m.descripcion) + '</textarea></label>' +
      '<div class="row wrap end">' + (m.id ? '<button class="btn danger" data-action="maq.borrar" data-id="' + esc(m.id) + '">Eliminar</button>' : '') +
      '<button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="maq.guardar" data-id="' + esc(m.id || '') + '">Guardar</button></div>');
  }
  async function guardar(id) {
    const v = k => document.getElementById(k).value.trim();
    const row = { codigo: v('mf-cod'), tipo: v('mf-tipo') || null, estado: v('mf-est'), nota: v('mf-nota') || null, descripcion: v('mf-desc') || null };
    if (!row.codigo) throw new Error('El código es obligatorio');
    const q = id ? U.sb.from('upbq_maquinas').update(row).eq('id', id) : U.sb.from('upbq_maquinas').insert(row);
    const { error } = await q;
    if (error) throw new Error(error.code === '23505' ? 'Ya existe una máquina con ese código' : error.message);
    U.toast('Máquina guardada');
    U.closeModal();
    await render();
  }
  async function toggle(id) {
    const m = maquinas.find(x => x.id === id), nuevo = m.estado === 'varada' ? 'disponible' : 'varada';
    const { error } = await U.sb.from('upbq_maquinas').update({ estado: nuevo }).eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast(m.codigo + ' → ' + EST[nuevo] + (nuevo === 'varada' && !m.nota ? ' · toca “Editar / nota” para anotar el motivo' : ''));
    await render();
  }
  async function borrar(id) {
    const m = maquinas.find(x => x.id === id);
    if (!(await U.confirmar('¿Eliminar la máquina ' + m.codigo + '? Solo se puede si no tiene alquileres asociados.'))) return form(m);
    const { error } = await U.sb.from('upbq_maquinas').delete().eq('id', id);
    if (error) {
      U.toast(error.code === '23503' ? m.codigo + ' tiene alquileres asociados: no se puede eliminar (márcala varada o déjala como está).' : error.message, 'err');
      return form(m);
    }
    U.toast('Máquina eliminada');
    await render();
  }

  function handle(a, id) {
    switch (a) {
      case 'filtro': filtro = id; return render();
      case 'nueva': return form();
      case 'editar': return form(maquinas.find(x => x.id === id));
      case 'guardar': return guardar(id);
      case 'toggle': return toggle(id);
      case 'borrar': return borrar(id);
    }
  }
  global.UPBQ.modulos.maq = { render, handle };
})(window);
