// Regresión del login (Playwright + Supabase simulado). Ejecutar: node tests/smoke_login.js
// Cubre: la pantalla de login se oculta tras entrar y Enter mantenido no dispara varios inicios de sesión.
const { chromium } = require('playwright');
const assert = require('assert');
const STUB = `
window.__logins = 0; let sesion = null;
const mk = () => { const q = { select:()=>q, eq:()=>q, in:()=>q, lte:()=>q, order:()=>q, limit:()=>q, then:f=>f({data:[],error:null}) }; return q; };
window.supabase = { createClient: () => ({ auth: {
  getSession: async () => ({ data:{ session } }) , signOut: async () => { sesion = null; },
  signInWithPassword: async () => { window.__logins++; await new Promise(r => setTimeout(r, 190)); session = {}; return { error:null }; } },
  from: () => mk() }) };
var session = null;`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/supabase-js@2', r => r.fulfill({ contentType: 'text/javascript', body: STUB }));
  await p.goto('file://' + require('path').join(__dirname, '..', 'index.html')); await p.waitForTimeout(400);
  await p.fill('#lg-email', 'x@y.co'); await p.fill('#lg-pass', 'clave');
  // Simula Enter mantenido: 8 pulsaciones (repeat) seguidas
  await p.focus('#lg-pass');
  for (let i = 0; i < 8; i++) await p.keyboard.down('Enter');
  await p.keyboard.up('Enter'); await p.waitForTimeout(900);
  const loginVisible = await p.isVisible('#login'), appVisible = await p.isVisible('#app');
  const box = await p.evaluate(() => Math.round(document.getElementById('app').getBoundingClientRect().top));
  console.log('tras login -> #login visible:', loginVisible, '| #app visible:', appVisible, '| top de #app:', box + 'px', '| signIn llamados:', await p.evaluate(() => window.__logins));
  console.log('errs', JSON.stringify(errs));
  await b.close();
  const ok = loginVisible === false && appVisible && (await new Promise(r => r(true)));
  console.log(ok ? 'OK login' : 'FALLÓ login');
  process.exit(ok ? 0 : 1);
})();
