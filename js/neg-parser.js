(function (global) {
  'use strict';
  // Parseo 100% local de exports de WhatsApp (.txt, Android e iOS) y de JSON estructurado.
  // Sin red, sin terceros. Las fechas se interpretan como hora de Bogotá (UTC-5, sin horario de verano).

  function limpiar(t) {
    return String(t == null ? '' : t)
      .replace(/^﻿/, '')
      .replace(/[‎‏‪-‮⁦-⁩]/g, '') // marcas de dirección que mete WhatsApp
      .replace(/[  ]/g, ' ')                          // espacios "finos" antes de a. m./p. m.
      .replace(/\r\n?/g, '\n');
  }
  const p2 = n => String(n).padStart(2, '0');
  function isoBogota(y, mo, d, h, mi, s) {
    return y + '-' + p2(mo) + '-' + p2(d) + 'T' + p2(h) + ':' + p2(mi) + ':' + p2(s || 0) + '-05:00';
  }
  // hash determinista (cyrb53) para detectar duplicados al reimportar
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  const CAB = /^\[?(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([ap])\.?\s*m\.?)?\]?\s*(?:[-–—]\s*)?(.*)$/i;
  const REMITENTE = /^([^:]{1,50}?):\s?([\s\S]*)$/;

  function parseWhatsApp(texto) {
    const lineas = limpiar(texto).split('\n');
    const crudos = [];
    let cur = null, ignoradas = 0;
    for (const linea of lineas) {
      const m = CAB.exec(linea);
      if (m) {
        if (cur) crudos.push(cur);
        cur = { a: Number(m[1]), b: Number(m[2]), y: Number(m[3]), h: Number(m[4]), mi: Number(m[5]), s: Number(m[6] || 0), ampm: m[7] ? m[7].toLowerCase() : '', resto: m[8] };
      } else if (cur) {
        cur.resto += '\n' + linea;
      }
    }
    if (cur) crudos.push(cur);

    // ¿dd/mm o mm/dd? Si algún segundo número pasa de 12 y ningún primero, es mm/dd. Por defecto dd/mm (Colombia).
    const hayA = crudos.some(c => c.a > 12), hayB = crudos.some(c => c.b > 12);
    const mdy = hayB && !hayA;
    const mensajes = [], remitentes = {};
    for (const c of crudos) {
      const dia = mdy ? c.b : c.a, mes = mdy ? c.a : c.b;
      const y = c.y < 100 ? 2000 + c.y : c.y;
      let h = c.h;
      if (c.ampm === 'p' && h < 12) h += 12;
      if (c.ampm === 'a' && h === 12) h = 0;
      if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || h > 23 || c.mi > 59) { ignoradas++; continue; }
      const r = REMITENTE.exec(c.resto);
      if (!r || /["“”]/.test(r[1])) { ignoradas++; continue; } // mensaje de sistema (cifrado, cambios de grupo…)
      const remitente = r[1].trim();
      let txt = r[2].trim(), adjunto = null, omitido = false, m;
      if ((m = /^<(?:adjunto|attached|archivo adjunto)\s*:\s*(.+?)>\s*([\s\S]*)$/i.exec(txt))) { adjunto = m[1].trim(); txt = m[2].trim(); }
      else if ((m = /^(\S.*?\.(?:jpe?g|png|webp|gif|pdf))\s*\((?:archivo adjunto|file attached)\)\s*([\s\S]*)$/i.exec(txt))) { adjunto = m[1].trim(); txt = m[2].trim(); }
      else if (/^<(?:multimedia omitido|media omitted)>$/i.test(txt) || /^(?:imagen|video|audio|sticker|documento|archivo)\s+omitid[oa]$/i.test(txt)) { omitido = true; txt = ''; }
      remitentes[remitente] = (remitentes[remitente] || 0) + 1;
      mensajes.push({ fecha: isoBogota(y, mes, dia, h, c.mi, c.s), remitente, texto: txt, adjunto, omitido });
    }
    if (!mensajes.length) throw new Error('No encontré mensajes con formato de WhatsApp en ese texto');
    return { origen: 'whatsapp', mensajes, remitentes, ignoradas, formato: mdy ? 'mm/dd' : 'dd/mm' };
  }

  function parseJSON(texto) {
    let d;
    try { d = JSON.parse(texto); } catch (e) { throw new Error('JSON inválido: ' + e.message); }
    const arr = Array.isArray(d) ? d : d && d.mensajes;
    if (!Array.isArray(arr) || !arr.length) throw new Error('El JSON debe ser una lista de mensajes o un objeto {"mensajes": [...]}');
    const mensajes = arr.map((m, i) => {
      const n = 'Mensaje #' + (i + 1) + ': ';
      if (!m || typeof m !== 'object') throw new Error(n + 'no es un objeto');
      let fecha = String(m.fecha || '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fecha += 'T12:00:00-05:00';
      else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(fecha)) fecha = fecha.replace(' ', 'T') + (fecha.length <= 16 ? ':00' : '') + '-05:00';
      else if (isNaN(new Date(fecha).getTime())) throw new Error(n + 'fecha inválida (' + m.fecha + ')');
      else fecha = new Date(fecha).toISOString();
      if (m.emisor !== 'cliente' && m.emisor !== 'nosotros') throw new Error(n + 'emisor debe ser "cliente" o "nosotros"');
      const texto2 = String(m.texto != null ? m.texto : m.contenido || '').trim();
      if (!texto2) throw new Error(n + 'falta el texto');
      return { fecha, emisor: m.emisor, texto: texto2 };
    });
    return { origen: 'json', mensajes };
  }

  global.UPBQ = global.UPBQ || {};
  global.UPBQ.NegParser = { parseWhatsApp, parseJSON, hash, limpiar };
})(typeof window !== 'undefined' ? window : globalThis);
