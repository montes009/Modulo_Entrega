(function (global) {
  'use strict';
  const U = global.UPBQ, H = U.Habiles, AE = global.UPBQ_EST.alquiler;
  const DIAS = 35, DW = 30; // ventana del Gantt: 5 semanas, 30px por día
  const LETRAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  let maquinas = [], clientes = [], alquileres = [], ini = null, detalleId = null;

  function lunesDe(iso) { return U.addDays(iso, -((H.dow(iso) + 6) % 7)); }
  function nom(a) { return a.upbq_clientes ? a.upbq_clientes.nombre : '—'; }

  async function cargar() {
    const [m, c, a] = await Promise.all([
      U.sb.from('upbq_maquinas').select('*').order('codigo'),
      U.sb.from('upbq_clientes').select('id,nombre').order('nombre'),
      U.sb.from('upbq_alquileres').select('*, upbq_clientes(nombre), upbq_alquiler_novedades(*)').order('fecha_inicio'),
      H.cargar()
    ]);
    for (const r of [m, c, a]) if (r.error) throw r.error;
    maquinas = m.data; clientes = c.data; alquileres = a.data;
  }
  function novs(a) { return a.upbq_alquiler_novedades || []; }

  async function render() {
    await cargar();
    const hoy = U.today();
    if (!ini) ini = lunesDe(hoy);
    const fin = U.addDays(ini, DIAS - 1);

    // Cabecera: mes + letra + número por día
    let cab = '';
    for (let i = 0; i < DIAS; i++) {
      const d = U.addDays(ini, i), [, mm, dd] = d.split('-');
      const cls = (H.esFestivo(d) ? ' fest' : H.esFinDeSemana(d) ? ' fds' : '') + (d === hoy ? ' hoy' : '');
      const mes = (dd === '01' || i === 0) ? '<i>' + MESES[Number(mm) - 1] + '</i>' : '';
      cab += '<div class="gd' + cls + '" title="' + esc(H.nombreFestivo(d) || U.fmtFecha(d)) + '">' + mes + LETRAS[H.dow(d)] + '<b>' + Number(dd) + '</b></div>';
    }
    const filas = maquinas.map(m => {
      const mias = alquileres.filter(a => a.maquina_id === m.id);
      const activoHoy = mias.find(a => a.estado === 'activo' && a.fecha_inicio <= hoy && a.fecha_fin >= hoy);
      const proximo = mias.filter(a => a.estado === 'activo' && a.fecha_inicio > hoy)[0];
      const estado = activoHoy ? '<span class="badge alq">Hasta ' + U.fmtFecha(activoHoy.fecha_fin) + '</span>'
        : proximo ? '<span class="badge libre">Libre · sigue ' + U.fmtFecha(proximo.fecha_inicio) + '</span>' : '<span class="badge libre">Libre</span>';
      let celdas = '';
      for (let i = 0; i < DIAS; i++) {
        const d = U.addDays(ini, i);
        celdas += '<div class="gc' + (H.esFestivo(d) ? ' fest' : H.esFinDeSemana(d) ? ' fds' : '') + (d === hoy ? ' hoy' : '') + '"></div>';
      }
      const barras = mias.filter(a => a.fecha_fin >= ini && a.fecha_inicio <= fin).map(a => {
        const desde = a.fecha_inicio < ini ? ini : a.fecha_inicio, hasta = a.fecha_fin > fin ? fin : a.fecha_fin;
        const left = U.diffDays(ini, desde) * DW, w = (U.diffDays(desde, hasta) + 1) * DW;
        const venc = a.estado === 'activo' && a.fecha_fin < hoy;
        return '<div class="barra ' + (a.estado === 'finalizado' ? 'fin' : venc ? 'venc' : 'act') + '" style="left:' + left + 'px;width:' + w + 'px" data-action="maq.ver" data-id="' + esc(a.id) + '" title="' +
          esc(nom(a) + ' · ' + U.fmtFecha(a.fecha_inicio) + ' → ' + U.fmtFecha(a.fecha_fin)) + '">' + esc(nom(a)) + ' · ' + U.fmtFecha(a.fecha_inicio).slice(0, 5) + '–' + U.fmtFecha(a.fecha_fin).slice(0, 5) + '</div>';
      }).join('');
      return '<div class="gfila"><div class="gnom"><b>' + esc(m.codigo) + '</b><small>' + esc(m.tipo || '') + '</small>' + estado +
        '<button class="btn mini-b" data-action="maq.alq-nuevo" data-id="' + esc(m.id) + '">+ Alquiler</button></div><div class="gtrack">' + celdas + barras + '</div></div>';
    }).join('');

    const aviso = H.cubre(fin) ? '' : '<p class="aviso">⚠ Faltan festivos cargados para ' + fin.slice(0, 4) + ': los días hábiles se cuentan solo excluyendo fines de semana.</p>';
    document.getElementById('vista').innerHTML = '<div class="head"><h2>Máquinas</h2><div class="row">' +
      '<button class="btn" data-action="maq.nav" data-id="-14">◀</button><button class="btn" data-action="maq.nav" data-id="0">Hoy</button><button class="btn" data-action="maq.nav" data-id="14">▶</button>' +
      '<button class="btn primary" data-action="maq.nueva">+ Máquina</button></div></div>' + aviso +
      (maquinas.length ? '<div class="gantt" style="--dw:' + DW + 'px;--n:' + DIAS + '"><div class="gfila gcab"><div class="gnom"></div><div class="gtrack">' + cab + '</div></div>' + filas + '</div>' +
        '<p class="leyenda"><span class="barra act">Activo</span> <span class="barra venc">Vencido sin finalizar</span> <span class="barra fin">Finalizado</span> · sombreado = fin de semana / festivo</p>'
        : '<p class="vacio">Aún no hay máquinas. Crea la primera con “+ Máquina”.</p>');
  }

  function formMaquina() {
    U.openModal('<h3>Nueva máquina</h3><label>Código / identificación<input id="mf-cod"></label><label>Tipo<input id="mf-tipo" placeholder="p. ej. Grúa, Retroexcavadora"></label>' +
      '<label>Descripción<textarea id="mf-desc" rows="2"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="maq.guardar-maq">Guardar</button></div>');
  }
  async function guardarMaquina() {
    const v = k => document.getElementById(k).value.trim();
    const codigo = v('mf-cod');
    if (!codigo) throw new Error('El código es obligatorio');
    const { error } = await U.sb.from('upbq_maquinas').insert({ codigo, tipo: v('mf-tipo') || null, descripcion: v('mf-desc') || null });
    if (error) throw new Error(error.code === '23505' ? 'Ya existe una máquina con ese código' : error.message);
    U.toast('Máquina creada');
    U.closeModal();
    await render();
  }

  function formAlquiler(maquinaId) {
    if (!clientes.length) { U.toast('Primero crea un cliente', 'err'); return; }
    const hoy = U.today();
    U.openModal('<h3>Nuevo alquiler</h3>' +
      '<label>Máquina<select id="af-maq">' + maquinas.map(m => '<option value="' + esc(m.id) + '"' + (m.id === maquinaId ? ' selected' : '') + '>' + esc(m.codigo + (m.tipo ? ' · ' + m.tipo : '')) + '</option>').join('') + '</select></label>' +
      '<label>Cliente<select id="af-cli">' + clientes.map(c => '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('') + '</select></label>' +
      '<label>Inicio<input id="af-ini" type="date" value="' + hoy + '"></label><label>Fin<input id="af-fin" type="date" value="' + hoy + '"></label>' +
      '<label>Notas<textarea id="af-notas" rows="2"></textarea></label>' +
      '<div class="row end"><button class="btn" data-action="modal.cerrar">Cancelar</button><button class="btn primary" data-action="maq.guardar-alq">Guardar</button></div>');
  }
  // Un equipo no puede estar en dos alquileres activos a la vez.
  function choque(maquinaId, desde, hasta, excluirId) {
    return alquileres.find(a => a.id !== excluirId && a.maquina_id === maquinaId && a.estado === 'activo' && a.fecha_inicio <= hasta && a.fecha_fin >= desde);
  }
  async function guardarAlquiler() {
    const v = k => document.getElementById(k).value;
    const row = { maquina_id: v('af-maq'), cliente_id: v('af-cli'), fecha_inicio: v('af-ini'), fecha_fin: v('af-fin'), notas: v('af-notas').trim() || null };
    if (!row.fecha_inicio || !row.fecha_fin) throw new Error('Indica fecha de inicio y de fin');
    if (row.fecha_fin < row.fecha_inicio) throw new Error('La fecha de fin no puede ser anterior al inicio');
    const c = choque(row.maquina_id, row.fecha_inicio, row.fecha_fin);
    if (c) throw new Error('La máquina ya está alquilada a ' + nom(c) + ' del ' + U.fmtFecha(c.fecha_inicio) + ' al ' + U.fmtFecha(c.fecha_fin));
    const { error } = await U.sb.from('upbq_alquileres').insert(row);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast('Alquiler creado');
    U.closeModal();
    if (!ini || row.fecha_inicio < ini || row.fecha_inicio > U.addDays(ini, DIAS - 1)) ini = lunesDe(row.fecha_inicio); // llevar el Gantt al alquiler nuevo
    await render();
  }

  function detalle(id) {
    const a = alquileres.find(x => x.id === id);
    if (!a) return;
    detalleId = id;
    const m = maquinas.find(x => x.id === a.maquina_id) || {};
    const r = H.contar(a.fecha_inicio, a.fecha_fin, novs(a));
    const hoy = U.today();
    const nvs = novs(a).slice().sort((x, y) => x.fecha_desde < y.fecha_desde ? -1 : 1);
    U.openModal('<h3>' + esc(m.codigo || '—') + ' · ' + esc(nom(a)) + ' <span class="badge ' + (a.estado === 'activo' ? 'activo' : '') + '">' + esc(AE[a.estado]) + '</span></h3>' +
      '<p>' + U.fmtFecha(a.fecha_inicio) + ' → ' + U.fmtFecha(a.fecha_fin) + (a.estado === 'activo' && a.fecha_fin < hoy ? ' <b class="rojo">· vencido sin finalizar</b>' : '') + '</p>' +
      '<div class="kpis"><div><b>' + r.habiles + '</b><small>días hábiles</small></div><div><b>' + r.descontados + '</b><small>por novedad</small></div><div><b>' + r.netos + '</b><small>días netos</small></div></div>' +
      (a.notas ? '<p class="nota">' + esc(a.notas) + '</p>' : '') +
      '<h4>Novedades (días no trabajados)</h4>' +
      (nvs.length ? nvs.map(n => '<div class="mini"><div>' + U.fmtFecha(n.fecha_desde) + (n.fecha_hasta !== n.fecha_desde ? ' → ' + U.fmtFecha(n.fecha_hasta) : '') + ' · <b>' + esc(n.motivo) + '</b>' + (n.nota ? ' · ' + esc(n.nota) : '') +
        '</div><button class="btn mini-b" data-action="maq.nov-del" data-id="' + esc(n.id) + '">Quitar</button></div>').join('') : '<p class="vacio">Sin novedades</p>') +
      '<div class="subform"><div class="row"><label>Desde<input id="nv-desde" type="date" value="' + esc(hoy < a.fecha_inicio ? a.fecha_inicio : hoy > a.fecha_fin ? a.fecha_fin : hoy) + '"></label>' +
      '<label>Hasta<input id="nv-hasta" type="date" value="' + esc(hoy < a.fecha_inicio ? a.fecha_inicio : hoy > a.fecha_fin ? a.fecha_fin : hoy) + '"></label></div>' +
      '<label>Motivo<input id="nv-motivo" placeholder="Paro, lluvia, avería…"></label><label>Nota<input id="nv-nota"></label>' +
      '<div class="row end"><button class="btn" data-action="maq.nov-add" data-id="' + esc(id) + '">Registrar novedad</button></div></div>' +
      '<div class="row wrap end"><button class="btn" data-action="modal.cerrar">Cerrar</button><button class="btn" data-action="maq.editar-fechas" data-id="' + esc(id) + '">Editar fechas</button>' +
      (a.estado === 'activo' ? '<button class="btn ok" data-action="maq.finalizar" data-id="' + esc(id) + '">Finalizar alquiler</button>' : '') + '</div>');
  }
  async function repintar(id) { await render(); detalle(id); } // lista Y modal de detalle

  async function agregarNovedad(id) {
    const a = alquileres.find(x => x.id === id);
    const v = k => document.getElementById(k).value.trim();
    const row = { alquiler_id: id, fecha_desde: v('nv-desde'), fecha_hasta: v('nv-hasta'), motivo: v('nv-motivo'), nota: v('nv-nota') || null };
    if (!row.fecha_desde || !row.fecha_hasta) throw new Error('Indica desde y hasta');
    if (row.fecha_hasta < row.fecha_desde) throw new Error('“Hasta” no puede ser anterior a “Desde”');
    if (!row.motivo) throw new Error('El motivo es obligatorio');
    if (row.fecha_desde < a.fecha_inicio || row.fecha_hasta > a.fecha_fin) throw new Error('La novedad debe caer dentro del alquiler (' + U.fmtFecha(a.fecha_inicio) + ' → ' + U.fmtFecha(a.fecha_fin) + ')');
    const { error } = await U.sb.from('upbq_alquiler_novedades').insert(row);
    if (error) throw error;
    U.toast('Novedad registrada');
    await repintar(id);
  }
  async function quitarNovedad(novId) {
    const alq = detalleId;
    if (!(await U.confirmar('¿Quitar esta novedad? Los días volverán a contarse como trabajados.'))) return detalle(alq);
    const { error } = await U.sb.from('upbq_alquiler_novedades').delete().eq('id', novId);
    if (error) throw error;
    U.toast('Novedad eliminada');
    await repintar(alq);
  }
  async function finalizar(id) {
    if (!(await U.confirmar('¿Finalizar este alquiler? La máquina quedará libre.'))) return detalle(id);
    const { error } = await U.sb.from('upbq_alquileres').update({ estado: 'finalizado' }).eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast('Alquiler finalizado');
    await repintar(id);
  }
  function formFechas(id) {
    const a = alquileres.find(x => x.id === id);
    U.openModal('<h3>Editar fechas</h3><label>Inicio<input id="ef-ini" type="date" value="' + esc(a.fecha_inicio) + '"></label><label>Fin<input id="ef-fin" type="date" value="' + esc(a.fecha_fin) + '"></label>' +
      '<div class="row end"><button class="btn" data-action="maq.ver" data-id="' + esc(id) + '">Volver</button><button class="btn primary" data-action="maq.guardar-fechas" data-id="' + esc(id) + '">Guardar</button></div>');
  }
  async function guardarFechas(id) {
    const a = alquileres.find(x => x.id === id);
    const ini2 = document.getElementById('ef-ini').value, fin2 = document.getElementById('ef-fin').value;
    if (!ini2 || !fin2 || fin2 < ini2) throw new Error('Fechas inválidas');
    if (a.estado === 'activo') { const c = choque(a.maquina_id, ini2, fin2, id); if (c) throw new Error('Choca con el alquiler de ' + nom(c) + ' (' + U.fmtFecha(c.fecha_inicio) + ' → ' + U.fmtFecha(c.fecha_fin) + ')'); }
    const fuera = novs(a).find(n => n.fecha_desde < ini2 || n.fecha_hasta > fin2);
    if (fuera) throw new Error('Hay una novedad (' + fuera.motivo + ') fuera de las nuevas fechas: quítala o ajústala primero');
    const { error } = await U.sb.from('upbq_alquileres').update({ fecha_inicio: ini2, fecha_fin: fin2 }).eq('id', id);
    if (error) throw error;
    U.dirty.panel = true;
    U.toast('Fechas actualizadas');
    await repintar(id);
  }

  function handle(a, id, el) {
    switch (a) {
      case 'nav': ini = Number(id) === 0 ? lunesDe(U.today()) : U.addDays(ini || lunesDe(U.today()), Number(id)); return render();
      case 'nueva': return formMaquina();
      case 'guardar-maq': return guardarMaquina();
      case 'alq-nuevo': return formAlquiler(id);
      case 'guardar-alq': return guardarAlquiler();
      case 'ver': return detalle(id);
      case 'nov-add': return agregarNovedad(id);
      case 'nov-del': return quitarNovedad(id);
      case 'finalizar': return finalizar(id);
      case 'editar-fechas': return formFechas(id);
      case 'guardar-fechas': return guardarFechas(id);
    }
  }
  global.UPBQ.modulos.maq = { render, handle };
})(window);
