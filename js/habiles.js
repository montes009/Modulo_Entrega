(function (global) {
  'use strict';
  // ÚNICO helper de días hábiles del sistema: excluye sábados, domingos y festivos de Colombia
  // (tabla upbq_festivos) y descuenta los días de novedad registrados en el alquiler.
  const U = global.UPBQ;
  let festivos = new Map(); // 'YYYY-MM-DD' -> nombre
  let maxAnio = 0;

  function dow(iso) { return new Date(iso + 'T12:00:00Z').getUTCDay(); } // 0=dom … 6=sáb
  function esFinDeSemana(iso) { const d = dow(iso); return d === 0 || d === 6; }
  function esFestivo(iso) { return festivos.has(iso); }
  function nombreFestivo(iso) { return festivos.get(iso) || ''; }
  function esHabil(iso) { return !esFinDeSemana(iso) && !esFestivo(iso); }

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
  // Cuenta días del rango [desde, hasta] (inclusive).
  // habiles = lun-vie no festivos; descontados = hábiles cubiertos por alguna novedad; netos = habiles - descontados.
  function contar(desde, hasta, novedades) {
    let habiles = 0, descontados = 0;
    if (!desde || !hasta || hasta < desde) return { habiles, descontados, netos: 0 };
    const total = U.diffDays(desde, hasta);
    if (total > 3660) throw new Error('Rango demasiado largo para contar días hábiles');
    for (let i = 0; i <= total; i++) {
      const d = U.addDays(desde, i);
      if (!esHabil(d)) continue;
      habiles++;
      if (enNovedad(d, novedades)) descontados++;
    }
    return { habiles, descontados, netos: habiles - descontados };
  }

  global.UPBQ.Habiles = { cargar, cubre, esHabil, esFestivo, esFinDeSemana, nombreFestivo, contar, dow };
})(window);
