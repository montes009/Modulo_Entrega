(function (global) {
  'use strict';
  // ÚNICO helper de días laborales del sistema. Qué días se EXCLUYEN es configurable por alquiler
  // (sábados / domingos / festivos de Colombia, tabla upbq_festivos); por defecto se excluyen los tres.
  // Los días de novedad (paro, clima…) se descuentan aparte del conteo.
  const U = global.UPBQ;
  const TODOS = { sab: true, dom: true, fest: true };
  let festivos = new Map(); // 'YYYY-MM-DD' -> nombre
  let maxAnio = 0;

  function dow(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); } // 0=dom … 6=sáb
  function esFinDeSemana(iso) { const d = dow(iso); return d === 0 || d === 6; }
  function esFestivo(iso) { return festivos.has(iso); }
  function nombreFestivo(iso) { return festivos.get(iso) || ''; }
  // Excluido según las opciones {sab, dom, fest}. Sin opciones = se excluyen los tres.
  function esExcluido(iso, opts) {
    const o = opts || TODOS, d = dow(iso);
    return (o.sab !== false && d === 6) || (o.dom !== false && d === 0) || (o.fest !== false && festivos.has(iso));
  }
  function esHabil(iso, opts) { return !esExcluido(iso, opts); }
  function motivoExclusion(iso, opts) {
    const o = opts || TODOS, d = dow(iso);
    if (o.fest !== false && festivos.has(iso)) return festivos.get(iso) || 'Festivo';
    if (o.sab !== false && d === 6) return 'Sábado';
    if (o.dom !== false && d === 0) return 'Domingo';
    return '';
  }
  // Opciones guardadas en un alquiler (columnas excluir_*); si faltan, se excluyen los tres.
  function opcionesDe(a) {
    return { sab: !a || a.excluir_sabados !== false, dom: !a || a.excluir_domingos !== false, fest: !a || a.excluir_festivos !== false };
  }

  async function cargar() {
    const { data, error } = await U.sb.from('upbq_festivos').select('fecha,nombre');
    if (error) throw error;
    festivos = new Map(data.map(f => [f.fecha, f.nombre]));
    maxAnio = data.reduce((m, f) => Math.max(m, Number(f.fecha.slice(0, 4))), 0);
    return data.length;
  }
  // ¿El rango toca años sin festivos cargados? (para avisar en vez de contar mal en silencio)
  function cubre(hasta) { return maxAnio >= Number(String(hasta).slice(0, 4)); }

  function enNovedad(iso, novedades) {
    return (novedades || []).some(n => iso >= n.fecha_desde && iso <= n.fecha_hasta);
  }
  // Cuenta el rango [desde, hasta] (inclusive):
  //   habiles = laborales (no excluidos) · excluidos = días excluidos · calendario = total de días
  //   descontados = laborales cubiertos por alguna novedad · netos = habiles - descontados
  function contar(desde, hasta, novedades, opts) {
    const r = { habiles: 0, excluidos: 0, calendario: 0, descontados: 0, netos: 0 };
    if (!desde || !hasta || hasta < desde) return r;
    const total = U.diffDays(desde, hasta);
    if (total > 3660) throw new Error('Rango demasiado largo para contar días');
    for (let i = 0; i <= total; i++) {
      const d = U.addDays(desde, i);
      r.calendario++;
      if (esExcluido(d, opts)) { r.excluidos++; continue; }
      r.habiles++;
      if (enNovedad(d, novedades)) r.descontados++;
    }
    r.netos = r.habiles - r.descontados;
    return r;
  }
  // Fecha en la que se cumple el día laboral N contando desde `inicio` (el inicio cuenta si es laboral).
  function fechaFin(inicio, dias, opts) {
    const n = Math.floor(Number(dias));
    if (!inicio || !(n >= 1)) return '';
    let cur = inicio, hechos = 0, guardia = 0;
    for (;;) {
      if (!esExcluido(cur, opts)) { hechos++; if (hechos === n) return cur; }
      cur = U.addDays(cur, 1);
      if (++guardia > 4000) throw new Error('No se pudo calcular la fecha fin');
    }
  }

  global.UPBQ.Habiles = { cargar, cubre, esHabil, esExcluido, esFestivo, esFinDeSemana, nombreFestivo, motivoExclusion, opcionesDe, contar, fechaFin, enNovedad, dow };
})(window);
