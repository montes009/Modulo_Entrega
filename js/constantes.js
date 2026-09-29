(function (global) {
  'use strict';
  // Fuente única de estados. Debe espejar los CHECK de sql/001_upbq_base.sql.
  global.UPBQ_EST = {
    cliente: { activo: 'Activo', en_mora: 'En mora', bloqueado: 'Bloqueado', prospecto: 'Prospecto', inactivo: 'Inactivo' },
    cotizacion: { borrador: 'Borrador', enviada: 'Enviada', en_seguimiento: 'En seguimiento', cerrada_ganada: 'Cerrada · ganada', cerrada_perdida: 'Cerrada · perdida' },
    recordatorio: { pendiente: 'Pendiente', hecho: 'Hecho', negocio_cae: 'Negocio cae' },
    alquiler: { activo: 'Activo', finalizado: 'Finalizado' }
  };
  global.UPBQ_SEGUIMIENTO_DIAS = 3; // auto-recordatorio tras enviar cotización
  global.UPBQ_SIN_RESPUESTA_DIAS = 5; // umbral del widget "sin respuesta"
  global.UPBQ_NEG_SIN_MOVIMIENTO_DIAS = 7; // hilo con cotización abierta sin mensajes en N días → recontacto
})(window);
