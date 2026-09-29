(function (global) {
  'use strict';
  const U = global.UPBQ;
  const TABS = { pan: 'Panel', cli: 'Clientes', cot: 'Cotizaciones' };
  let tab = 'pan';

  async function irA(t) {
    tab = t;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
    await U.seguro(() => U.modulos[t].render());
  }
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
  async function login() {
    const email = document.getElementById('lg-email').value.trim();
    const password = document.getElementById('lg-pass').value;
    const { error } = await U.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    mostrar(true);
    irA('pan');
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
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'lg-pass') document.querySelector('[data-action="login"]').click(); });
  document.addEventListener('DOMContentLoaded', () => U.seguro(iniciar));
})(window);
