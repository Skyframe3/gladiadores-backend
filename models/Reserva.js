import mongoose from 'mongoose';

const reservaSchema = new mongoose.Schema({
  folio: { type: String, unique: true, required: true },

  // Datos del cliente
  cliente: {
    nombre: { type: String, required: true },
    email: { type: String, required: true },
    whatsapp: { type: String, required: true }
  },

  // Datos de la ruta
  ruta: { type: String, required: true },
  rutaId: { type: Number, index: true },       // rid de la ruta reservada
  unidad: { type: String, required: true },    // nombre legible
  unidadCodigo: { type: String, index: true }, // máquina física de la flota
  horario: { type: String, required: true },
  fecha: { type: Date, required: true },
  // La renta es del vehículo completo; personas es solo cuántos van, no
  // asientos individuales que se puedan vender por separado.
  personas: { type: Number, required: true, min: 1, max: 12 },

  // Extras
  extras: [String],

  // Pago: monto es lo que se paga ahora (anticipo o total, según modoPago);
  // montoTotal es el precio completo de la ruta, para que el panel sepa
  // cuánto falta por cobrar cuando el cliente eligió solo anticipo.
  monto: { type: Number, required: true },
  montoTotal: { type: Number, required: true },
  modoPago: { type: String, enum: ['anticipo', 'completo'], default: 'anticipo' },
  // 'whatsapp' = solicitud manual (hoy); 'mercadopago' = cuando se conecte
  // la pasarela y el cobro quede automatizado.
  metodoPago: { type: String, enum: ['whatsapp', 'mercadopago'], default: 'whatsapp' },
  estadoPago: { type: String, enum: ['pendiente', 'pagado', 'reembolsado'], default: 'pendiente' },
  mpPaymentId: { type: String, index: true }, // ID de transacción en Mercado Pago
  mpPreferenceId: { type: String }, // ID de preferencia/checkout en Mercado Pago

  // Estado de la reserva
  estado: { type: String, enum: ['confirmada', 'cancelada', 'completada', 'no_show'], default: 'confirmada' },

  // Notificaciones
  whatsappEnviado: { type: Boolean, default: false },
  emailEnviado: { type: Boolean, default: false },

  // Timestamps
  creadaEn: { type: Date, default: Date.now },
  actualizadaEn: { type: Date, default: Date.now }
});

// Consultar qué unidades están ocupadas en una fecha y horario es
// la operación más frecuente del sistema de reservas.
reservaSchema.index({ fecha: 1, horario: 1, estado: 1 });

// La misma máquina física no se puede vender dos veces el mismo día. El
// checkeo en JS antes del save() (routes/reservas.js) tiene una rendija:
// dos reservas casi simultáneas por la última unidad libre pueden pasar
// las dos el checkeo antes de que cualquiera termine de guardarse. Este
// índice lo cierra a nivel de base de datos — MongoDB rechaza el segundo
// insert con un error de duplicado, no importa qué tan rápido lleguen.
//
// Parcial y filtrado por 'confirmada' (no "distinto de cancelada") porque
// MongoDB solo admite $eq/$exists/$gt/$gte/$lt/$lte/$type en el filtro de
// un índice parcial — $ne no es válido ahí. Toda reserva nueva nace en
// estado 'confirmada' (routes/reservas.js nunca manda otro valor al
// crearla), que es exactamente el estado en el que puede haber una
// carrera entre dos POST simultáneos, así que el filtro cubre el caso real.
reservaSchema.index(
  { unidadCodigo: 1, fecha: 1 },
  { unique: true, partialFilterExpression: { estado: { $eq: 'confirmada' } } }
);

reservaSchema.pre('save', function (next) {
  this.actualizadaEn = new Date();
  next();
});

export default mongoose.model('Reserva', reservaSchema);
