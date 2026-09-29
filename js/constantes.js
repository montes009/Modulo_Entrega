(function (global) {
  'use strict';
  // Fuente única de estados. Debe espejar los CHECK de sql/ (001, 007). Los códigos no cambian; las etiquetas son solo texto.
  global.UPBQ_EST = {
    cliente: { activo: 'Activo', en_mora: 'En mora', bloqueado: 'Bloqueado', prospecto: 'Prospecto', inactivo: 'Inactivo' },
    // cerrada_ganada = el cliente APROBÓ la cotización (de ahí se monta el alquiler); cerrada_perdida = no la aprobó
    cotizacion: { borrador: 'Borrador', enviada: 'Enviada', en_seguimiento: 'En seguimiento', cerrada_ganada: 'Aprobada', cerrada_perdida: 'No aprobada' },
    recordatorio: { pendiente: 'Pendiente', hecho: 'Hecho', negocio_cae: 'Negocio cae' },
    alquiler: { activo: 'Activo', finalizado: 'Finalizado' },
    // Estado MANUAL del equipo (cuadro visual); se cambia libremente y no bloquea asignarlo a un alquiler
    maquina: { disponible: 'Disponible', varada: 'Varada' },
    prioridad: { baja: 'Baja', media: 'Media', alta: 'Alta' }
  };
  global.UPBQ_SEGUIMIENTO_DIAS = 3; // auto-recordatorio tras enviar cotización
  global.UPBQ_SIN_RESPUESTA_DIAS = 5; // umbral del widget "sin respuesta"
  global.UPBQ_NEG_SIN_MOVIMIENTO_DIAS = 7; // hilo con cotización abierta sin mensajes en N días → recontacto
})(window);
