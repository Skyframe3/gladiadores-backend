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
  unidad: { type: String, required: true },
  horario: { type: String, required: true },
  fecha: { type: Date, required: true },
  asientos: [Number],

  // Extras
  extras: [String],

  // Pago
  monto: { type: Number, required: true },
  modoPago: { type: String, enum: ['anticipo', 'completo'], default: 'anticipo' },
  metodoPago: { type: String, enum: ['mercadopago'], default: 'mercadopago' },
  estadoPago: { type: String, enum: ['pendiente', 'pagado', 'reembolsado'], default: 'pendiente' },

  // Estado de la reserva
  estado: { type: String, enum: ['confirmada', 'cancelada', 'completada', 'no_show'], default: 'confirmada' },

  // Notificaciones
  whatsappEnviado: { type: Boolean, default: false },
  emailEnviado: { type: Boolean, default: false },

  // Timestamps
  creadaEn: { type: Date, default: Date.now },
  actualizadaEn: { type: Date, default: Date.now }
});

reservaSchema.pre('save', function (next) {
  this.actualizadaEn = new Date();
  next();
});

export default mongoose.model('Reserva', reservaSchema);
