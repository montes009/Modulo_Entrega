(function (global) {
  'use strict';
  const cfg = global.UPBQ_CONFIG;
  const sb = global.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // "Hoy" anclado a America/Bogota (YYYY-MM-DD). Nunca UTC ni hora del navegador.
  const fmtBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
  function today() { return fmtBogota.format(new Date()); }
  function addDays(iso, n) {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function diffDays(a, b) { return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5); }
  function fmtFecha(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d + '/' + m + '/' + y;
  }
  function fmtMoney(n) {
    return n == null ? '—' : '$' + Number(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  function toast(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || '');
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), tipo === 'err' ? 6000 : 2800);
  }
  function openModal(html) {
    const m = document.getElementById('modal');
    m.querySelector('.modal-body').innerHTML = html;
    m.hidden = false;
  }
  function closeModal() {
    const m = document.getElementById('modal');
    m.hidden = true;
    m.querySelector('.modal-body').innerHTML = '';
  }
  function modalAbierto() { return !document.getElementById('modal').hidden; }
  // Confirmación in-app (sin confirm() nativo). Devuelve Promise<boolean>.
  function confirmar(texto) {
    return new Promise(res => {
      openModal('<p>' + esc(texto) + '</p><div class="row end"><button class="btn" data-action="conf.no">Cancelar</button><button class="btn danger" data-action="conf.si">Confirmar</button></div>');
      global.__confRes = ok => { closeModal(); global.__confRes = null; res(ok); };
    });
  }
  function opts(mapa, sel) {
    return Object.keys(mapa).map(k => '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(mapa[k]) + '</option>').join('');
  }
  // Envuelve handlers: cualquier throw se muestra exacto en un toast.
  async function seguro(fn) {
    try { return await fn(); } catch (e) { console.error(e); toast(e && e.message ? e.message : String(e), 'err'); }
  }

  global.UPBQ = { sb, esc, today, addDays, diffDays, fmtFecha, fmtMoney, toast, openModal, closeModal, modalAbierto, confirmar, opts, seguro, modulos: {}, dirty: {} };
  global.esc = esc;
})(window);
