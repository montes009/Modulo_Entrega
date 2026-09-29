(function (global) {
  'use strict';
  const U = global.UPBQ;

  async function render() {
    const hoy = U.today();
    const [rec, cot, mora, pen, alq] = await Promise.all([
      U.sb.from('upbq_recordatorios').select('*, upbq_clientes(nombre)').eq('estado', 'pendiente').lte('fecha', hoy).order('fecha'),
      U.sb.from('upbq_cotizaciones').select('*, upbq_clientes(nombre)').in('estado', ['enviada', 'en_seguimiento']).order('fecha'),
      U.sb.from('upbq_clientes').select('id,nombre,telefono').eq('estado', 'en_mora').order('nombre'),
      U.sb.from('upbq_pendientes').select('*').eq('hecho', false).order('fecha', { nullsFirst: false }),
      U.sb.from('upbq_alquileres').select('*, upbq_clientes(nombre), upbq_maquinas(codigo,tipo)').eq('estado', 'activo').order('fecha_fin')
    ]);
    for (const r of [rec, cot, mora, pen, alq]) if (r.error) throw r.error;
    const sem = U.addDays(hoy, 7);
    const arrancan = alq.data.filter(a => a.fecha_inicio >= hoy && a.fecha_inicio <= sem);
    const terminan = alq.data.filter(a => a.fecha_fin >= hoy && a.fecha_fin <= sem && a.fecha_inicio <= hoy);
    const vencidos = alq.data.filter(a => a.fecha_fin < hoy);
    const filaAlq = (a, txt) => '<div class="item" data-action="pan.ir-maq"><div><b>' + esc(a.upbq_maquinas ? a.upbq_maquinas.codigo : '—') + ' · ' + esc(a.upbq_clientes ? a.upbq_clientes.nombre : '—') + '</b><small>' + txt + '</small></div></div>';
    const sinResp = cot.data.filter(q => U.diffDays(q.fecha, hoy) >= global.UPBQ_SIN_RESPUESTA_DIAS);

    const w = (titulo, n, cuerpo) => '<section class="widget"><h3>' + esc(titulo) + ' <span class="count">' + n + '</span></h3>' + cuerpo + '</section>';
    const vacio = t => '<p class="vacio">' + esc(t) + '</p>';

    document.getElementById('vista').innerHTML = '<div class="head"><h2>Hoy · ' + U.fmtFecha(hoy) + '</h2></div><div class="grid">' +
      w('Recordatorios de hoy y vencidos', rec.data.length, rec.data.length ? rec.data.map(r =>
        '<div class="item' + (r.fecha < hoy ? ' vencido' : '') + '"><div><b>' + esc(r.upbq_clientes ? r.upbq_clientes.nombre : 'General') + '</b><small>' + U.fmtFecha(r.fecha) + ' · ' + esc(r.texto) + '</small></div>' +
        '<div class="row"><button class="btn ok" data-action="pan.rec" data-id="' + esc(r.id) + '" data-to="hecho">Hecho</button><button class="btn danger" data-action="pan.rec" data-id="' + esc(r.id) + '" data-to="negocio_cae">Negocio cae</button></div></div>').join('') : vacio('Nada pendiente para hoy 🎉')) +
      w('Cotizaciones sin respuesta', sinResp.length, sinResp.length ? sinResp.map(q =>
        '<div class="item" data-action="cot.ver-desde-panel" data-id="' + esc(q.id) + '"><b>' + esc(q.upbq_clientes ? q.upbq_clientes.nombre : '—') + '</b><small>' + U.diffDays(q.fecha, hoy) + ' días · ' + esc(q.equipo || '—') + ' · ' + U.fmtMoney(q.valor) + '</small></div>').join('') : vacio('Ninguna')) +
      w('Alquileres que arrancan (7 días)', arrancan.length, arrancan.length ? arrancan.map(a => filaAlq(a, 'Inicia ' + U.fmtFecha(a.fecha_inicio))).join('') : vacio('Ninguno')) +
      w('Máquinas que se liberan (7 días)', terminan.length, terminan.length ? terminan.map(a => filaAlq(a, 'Termina ' + U.fmtFecha(a.fecha_fin) + ' · ' + U.diffDays(hoy, a.fecha_fin) + ' d')).join('') : vacio('Ninguna')) +
      (vencidos.length ? w('Alquileres vencidos sin finalizar', vencidos.length, vencidos.map(a => filaAlq(a, 'Terminó ' + U.fmtFecha(a.fecha_fin))).join('')) : '') +
      w('Clientes en mora', mora.data.length, mora.data.length ? mora.data.map(c => '<div class="item est-en_mora"><b>' + esc(c.nombre) + '</b><small>' + esc(c.telefono || '') + '</small></div>').join('') : vacio('Ninguno')) +
      w('Pendientes', pen.data.length,
        '<div class="row"><input id="pen-texto" placeholder="Nueva nota rápida…"><button class="btn primary" data-action="pan.pen-nuevo">Añadir</button></div>' +
        (pen.data.map(p => '<div class="item"><div><b>' + esc(p.texto) + '</b><small>' + (p.fecha ? U.fmtFecha(p.fecha) : '') + '</small></div><button class="btn ok" data-action="pan.pen-hecho" data-id="' + esc(p.id) + '">✓</button></div>').join('') || vacio('Sin pendientes'))) +
      '</div>';
  }
  async function handle(a, id, el) {
    switch (a) {
      case 'rec': {
        const { error } = await U.sb.from('upbq_recordatorios').update({ estado: el.dataset.to }).eq('id', id);
        if (error) throw error;
        U.toast('Recordatorio actualizado');
        return render();
      }
      case 'ir-maq': return document.querySelector('[data-tab="maq"]').click();
      case 'pen-nuevo': {
        const t = document.getElementById('pen-texto').value.trim();
        if (!t) throw new Error('Escribe el pendiente');
        const { error } = await U.sb.from('upbq_pendientes').insert({ texto: t });
        if (error) throw error;
        return render();
      }
      case 'pen-hecho': {
        const { error } = await U.sb.from('upbq_pendientes').update({ hecho: true }).eq('id', id);
        if (error) throw error;
        return render();
      }
    }
  }
  global.UPBQ.modulos.pan = { render, handle };
})(window);
