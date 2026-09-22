// app.js — arranque, gating de autenticación y ÚNICO listener delegado de acciones.
// Acciones vía data-action (click) y data-action de tipo change (selects / file inputs).
(function (global) {
  'use strict';

  var Util = global.Util || {};
  var guard = Util.guard || function (fn) { return fn; };
  var toast = Util.toast || function () {};

  // --- Enrutado de acciones de click ---
  function enrutarClick(accion, el) {
    var E = global.EntregasEquipo || {};
    var id = el.getAttribute('data-id');
    var rol = el.getAttribute('data-rol');
    switch (accion) {
      case 'login': return login();
      case 'logout': return logout();
      case 'nueva-entrega': return E.nueva && E.nueva();
      case 'crear-entrega': return E.crearEntrega && E.crearEntrega();
      case 'ver-entrega': return E.abrir && E.abrir(id);
      case 'agregar-item': return E.agregarItem && E.agregarItem();
      case 'cerrar-checklist': return E.cerrarChecklist && E.cerrarChecklist();
      case 'firmar': return E.abrirFirma && E.abrirFirma(rol);
      case 'guardar-firma': return E.guardarFirma && E.guardarFirma(rol);
      case 'limpiar-firma': return global.__firmaCtrl && global.__firmaCtrl.limpiar();
      case 'anular': return E.anular && E.anular(id);
      case 'confirmar-anular': return E.confirmarAnular && E.confirmarAnular(id);
      case 'imprimir-acta': return E.imprimir && E.imprimir(id);
      case 'cerrar-modal': return Util.cerrarModal && Util.cerrarModal();
      default: toast('Acción no reconocida: ' + accion, 'error');
    }
  }

  // --- Enrutado de acciones de change (selects / inputs) ---
  function enrutarChange(accion, el) {
    var E = global.EntregasEquipo || {};
    var item = el.getAttribute('data-item');
    switch (accion) {
      case 'responder-item': return E.responderItem && E.responderItem(item, el.value);
      case 'foto-item':
        return E.subirFotoItem && E.subirFotoItem(item, el.files && el.files[0]);
      default: /* no-op */;
    }
  }

  function onClick(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    // Los selects/inputs se manejan por 'change', no por 'click'.
    if (el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    enrutarClick(el.getAttribute('data-action'), el);
  }
  function onChange(ev) {
    var el = ev.target.closest('[data-action]');
    if (!el) return;
    enrutarChange(el.getAttribute('data-action'), el);
  }

  // --- Auth ---
  async function login() {
    var email = (document.getElementById('login-email') || {}).value;
    var pass = (document.getElementById('login-pass') || {}).value;
    if (!email || !pass) { toast('Email y contraseña', 'error'); return; }
    await global.Supa.login(email.trim(), pass);
    // onAuthStateChange dispara el resto (resolver empresa + cargar).
  }
  async function logout() {
    await global.Supa.logout();
    var E = global.EntregasEquipo; if (E && E.limpiarEstado) E.limpiarEstado(); // limpiar estado (Manual 9.2)
  }

  function mostrarSesion(haySesion) {
    var auth = document.getElementById('auth');
    var app = document.getElementById('app');
    var salir = document.querySelector('.btn-logout');
    if (auth) auth.style.display = haySesion ? 'none' : 'block';
    if (app) app.style.display = haySesion ? 'block' : 'none';
    if (salir) salir.style.display = haySesion ? 'inline-block' : 'none';
  }

  async function alEntrar() {
    var E = global.EntregasEquipo;
    var membresia = await global.Supa.empresaDelUsuario();
    if (!membresia) {
      toast('Tu usuario no tiene empresa asignada', 'error');
      mostrarSesion(true);
      return;
    }
    E.setSesion(membresia);
    var badge = document.getElementById('empresa-actual');
    if (badge) {
      var nombre = membresia.empresa_nombre || 'Empresa';
      badge.textContent = nombre + (membresia.rol ? ' · ' + membresia.rol : '');
    }
    // Crear entrega es solo admin/supervisor (el servidor lo hace cumplir; esto es UI).
    var btnNueva = document.querySelector('[data-action="nueva-entrega"]');
    if (btnNueva) {
      var puedeCrear = membresia.rol === 'admin' || membresia.rol === 'supervisor';
      btnNueva.style.display = puedeCrear ? 'inline-block' : 'none';
    }
    mostrarSesion(true);
    await E.cargar();
  }

  function init() {
    document.addEventListener('click', guard(onClick));
    document.addEventListener('change', guard(onChange));

    // Por defecto se muestra el login; nunca dejar la página en blanco si algo falla.
    mostrarSesion(false);

    if (!global.Supa || !global.supabase || typeof global.supabase.createClient !== 'function') {
      toast('No se pudo cargar Supabase (revisa la conexión y recarga)', 'error');
      return;
    }

    try {
      global.Supa.alCambiarAuth(guard(function (_evt, session) {
        if (session) { alEntrar(); }
        else {
          var E = global.EntregasEquipo; if (E && E.limpiarEstado) E.limpiarEstado();
          var badge = document.getElementById('empresa-actual'); if (badge) badge.textContent = '';
          mostrarSesion(false);
        }
      }));

      // Estado inicial según sesión existente.
      global.Supa.sesion().then(function (s) { if (s) alEntrar(); else mostrarSesion(false); })
        .catch(function (e) { toast('Error: ' + e.message, 'error'); mostrarSesion(false); });
    } catch (e) {
      toast('Error al iniciar Supabase: ' + e.message, 'error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
