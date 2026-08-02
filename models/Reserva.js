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
  asientos: [Number],
  // 'asientos' = comparte la unidad con otros; 'unidad' = la aparta completa
  modoVenta: { type: String, enum: ['asientos', 'unidad'], default: 'asientos' },

  // Extras
  extras: [String],

  // Pago
  monto: { type: Number, required: true },
  modoPago: { type: String, enum: ['anticipo', 'completo'], default: 'anticipo' },
  metodoPago: { type: String, enum: ['mercadopago'], default: 'mercadopago' },
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

reservaSchema.pre('save', function (next) {
  this.actualizadaEn = new Date();
  next();
});

export default mongoose.model('Reserva', reservaSchema);
