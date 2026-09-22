// config.js — configuración pública de Supabase (URL + anon key son públicas por diseño;
// la seguridad real está en RLS + RPCs, NO en ocultar la anon key).
//
// NUNCA poner aquí la service_role key ni credenciales de servidor.
// Para entornos locales, sobreescribir estos valores con un config.local.js ignorado.
(function (global) {
  'use strict';

  global.CONFIG = {
    SUPABASE_URL: 'https://tkekmpxwefjlkwegamfz.supabase.co',
    // Publishable key (pública por diseño; la seguridad real está en RLS + RPCs).
    SUPABASE_ANON_KEY: 'sb_publishable_dn1EyobwMt-XlQUudX4Q_A_inV3cNuW',
    STORAGE_BUCKET: 'entregas-privado', // bucket PRIVADO (ver CLAUDE.md > Almacenamiento)
    MAX_FOTO_MB: 8,
    MAX_LADO_PX: 1600 // redimensionar en cliente antes de subir
  };
})(window);
