// Prueba del parser de importación. Ejecutar: node tests/test_parser.js
const P = (() => { globalThis.window = undefined; require(require('path').join(__dirname, '..', 'js', 'neg-parser.js')); return globalThis.UPBQ.NegParser; })();
const assert = require('assert');
// Android (12 h con "p. m." y espacio fino U+202F, mensaje multilínea, sistema, adjunto, omitido)
const android = "12/03/2024, 3:45 p. m. - Los mensajes y las llamadas están cifrados de extremo a extremo.\n" +
"12/03/2024, 3:45 p. m. - Carlos Pérez: Buenas tardes, ¿cotización lista?\n" +
"12/03/2024, 3:47 p. m. - Yo: Sí señor,\nle envío la proforma hoy\ny el equipo queda libre el lunes\n" +
"13/03/2024, 12:05 a. m. - Carlos Pérez: IMG-20240313-WA0001.jpg (archivo adjunto)\nAquí la foto del sitio\n" +
"13/03/2024, 9:00 a. m. - Yo: <Multimedia omitido>\n" +
"15/03/2024, 8:10 - Carlos Pérez: Cotización.pdf (archivo adjunto)\n" +
"16/03/2024, 8:10 - Carlos Pérez cambió el asunto a \"Obra: torre\"\n";
let r = P.parseWhatsApp(android);
assert.strictEqual(r.mensajes.length, 5); assert.strictEqual(r.ignoradas, 2); assert.strictEqual(r.formato, 'dd/mm');
assert.strictEqual(r.mensajes[0].fecha, '2024-03-12T15:45:00-05:00');
assert.strictEqual(r.mensajes[1].texto, 'Sí señor,\nle envío la proforma hoy\ny el equipo queda libre el lunes');
assert.strictEqual(r.mensajes[2].fecha, '2024-03-13T00:05:00-05:00'); // 12:05 a. m. = 00:05
assert.strictEqual(r.mensajes[2].adjunto, 'IMG-20240313-WA0001.jpg'); assert.strictEqual(r.mensajes[2].texto, 'Aquí la foto del sitio');
assert.strictEqual(r.mensajes[3].omitido, true); assert.strictEqual(r.mensajes[4].adjunto, 'Cotización.pdf');
assert.deepStrictEqual(r.remitentes, { 'Carlos Pérez': 3, 'Yo': 2 });
// iOS: corchetes, segundos, marca LRM y <adjunto: …>
const ios = "‎[12/03/2024, 15:45:30] Carlos: hola\n‎[12/03/2024, 15:46:01] Yo: ‎<adjunto: 00000012-PHOTO-2024-03-12-15-46-01.jpg>\n[13/03/24, 9:00:00 a. m.] Carlos: ok\n";
r = P.parseWhatsApp(ios);
assert.strictEqual(r.mensajes.length, 3); assert.strictEqual(r.mensajes[1].adjunto, '00000012-PHOTO-2024-03-12-15-46-01.jpg');
assert.strictEqual(r.mensajes[2].fecha, '2024-03-13T09:00:00-05:00');
// mm/dd (EE. UU.) detectado por un día > 12 en la 2.ª posición
r = P.parseWhatsApp("3/14/24, 10:00 AM - A: x\n3/15/24, 11:00 PM - B: y\n");
assert.strictEqual(r.formato, 'mm/dd'); assert.strictEqual(r.mensajes[0].fecha, '2024-03-14T10:00:00-05:00'); assert.strictEqual(r.mensajes[1].fecha, '2024-03-15T23:00:00-05:00');
assert.throws(() => P.parseWhatsApp('hola esto no es un chat'), /No encontré/);
// JSON
r = P.parseJSON(JSON.stringify({ mensajes: [{ fecha: '2026-09-01 10:30', emisor: 'cliente', texto: 'Hola' }, { fecha: '2026-09-02', emisor: 'nosotros', texto: 'Listo' }] }));
assert.strictEqual(r.mensajes[0].fecha, '2026-09-01T10:30:00-05:00'); assert.strictEqual(r.mensajes[1].fecha, '2026-09-02T12:00:00-05:00');
assert.throws(() => P.parseJSON('[{"fecha":"2026-09-01","emisor":"otro","texto":"x"}]'), /emisor/);
assert.throws(() => P.parseJSON('{no'), /JSON inválido/);
// hash estable y sensible al contenido
assert.strictEqual(P.hash('a|b'), P.hash('a|b')); assert.notStrictEqual(P.hash('a|b'), P.hash('a|c'));
console.log('parser OK: 6 grupos de pruebas');
