(function (global) {
  'use strict';
  const U = global.UPBQ;
  const TABS = { pan: 'Panel', cli: 'Clientes', cot: 'Cotizaciones', maq: 'Máquinas', neg: 'Negociaciones' };
  let tab = 'pan';

  async function irA(t) {
    tab = t;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    await U.seguro(() => U.modulos[t].render());
  }
  U.irA = irA; // otros módulos navegan con U.irA('cli' | 'neg' | …)
  function mostrar(logueado) {
    document.getElementById('login').hidden = logueado;
    document.getElementById('app').hidden = !logueado;
  }
  async function iniciar() {
    document.getElementById('nav').innerHTML = Object.keys(TABS).map(k => '<button data-action="nav" data-id="' + k + '" data-tab="' + k + '">' + esc(TABS[k]) + '</button>').join('') + '<button data-action="salir">Salir</button>';
    const { data } = await U.sb.auth.getSession();
    mostrar(!!data.session);
    if (data.session) irA(tab);
  }
  let entrando = false; // evita inicios de sesión simultáneos (Enter mantenido, doble clic)
  async function login() {
    if (entrando) return;
    const email = document.getElementById('lg-email').value.trim();
    const password = document.getElementById('lg-pass').value;
    if (!email || !password) throw new Error('Escribe tu correo y tu contraseña');
    const btn = document.querySelector('[data-action="login"]');
    entrando = true; btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      const { error } = await U.sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
      document.getElementById('lg-pass').value = '';
      mostrar(true);
      await irA('pan');
    } finally { entrando = false; btn.disabled = false; btn.textContent = 'Entrar'; }
  }

  // Un único listener delegado: click → closest('[data-action]') → switch.
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const [mod, ...resto] = el.dataset.action.split('.');
    const a = resto.join('.');
    U.seguro(async () => {
      switch (el.dataset.action) {
        case 'nav': return irA(el.dataset.id);
        case 'salir': await U.sb.auth.signOut(); return mostrar(false);
        case 'login': return login();
        case 'modal.cerrar': return U.closeModal();
        case 'conf.si': return global.__confRes && global.__confRes(true);
        case 'conf.no': return global.__confRes && global.__confRes(false);
        case 'cot.ver-desde-panel': await irA('cot'); return U.modulos.cot.handle('ver', el.dataset.id, el);
      }
      const m = U.modulos[mod];
      if (typeof m === 'object' && typeof m.handle === 'function') {
        await m.handle(a, el.dataset.id, el);
      }
    });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.repeat && e.target.id === 'lg-pass') document.querySelector('[data-action="login"]').click(); });
  document.addEventListener('DOMContentLoaded', () => U.seguro(iniciar));
})(window);
