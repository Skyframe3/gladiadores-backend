import mongoose from 'mongoose';

// Una reserva puede llevar VARIAS máquinas (ej. 2 cuatrimotos + 1 Maverick).
// Cada renglón es una máquina física concreta de la flota, asignada por el
// servidor al momento de reservar.
const unidadReservadaSchema = new mongoose.Schema({
  categoriaId: { type: String, required: true },  // 'maverick-4'
  nombre: { type: String, required: true },       // 'Maverick X3 MAX'
  codigo: { type: String, required: true },       // 'MAV4-01' — máquina real
  personas: { type: Number, required: true, min: 1, max: 12 },
  precio: { type: Number, required: true, min: 0 }
}, { _id: false });

const reservaSchema = new mongoose.Schema({
  folio: { type: String, unique: true, required: true },

  cliente: {
    nombre: { type: String, required: true },
    email: { type: String, required: true },
    whatsapp: { type: String, required: true },
    // De dónde viene: sirve para saber a qué ciudades vale la pena
    // anunciarse y de dónde llega la gente que más gasta.
    ciudad: { type: String, default: '', maxlength: 80 }
  },

  ruta: { type: String, required: true },
  rutaId: { type: Number, index: true },
  horario: { type: String, required: true },
  fecha: { type: Date, required: true },

  unidades: { type: [unidadReservadaSchema], required: true, validate: v => v.length > 0 },
  personas: { type: Number, required: true, min: 1 },   // suma de todas las unidades

  extras: [String],
  nota: { type: String, default: '', maxlength: 600 },

  // montoTotal = precio completo. montoPagado = lo que ya entró (lo va
  // marcando el panel conforme llegan transferencias), para que quien
  // atiende sepa de un vistazo cuánto falta por cobrar.
  montoTotal: { type: Number, required: true },
  montoPagado: { type: Number, default: 0 },
  modoPago: { type: String, enum: ['anticipo', 'completo'], default: 'anticipo' },
  metodoPago: { type: String, enum: ['transferencia', 'efectivo'], default: 'transferencia' },
  estadoPago: { type: String, enum: ['pendiente', 'anticipo', 'pagado'], default: 'pendiente' },

  // pendiente  = la mandó el cliente, falta que llegue la transferencia
  // confirmada = ya se recibió el pago y el lugar está apartado en firme
  // completada = la ruta ya se hizo
  // pausada    = en espera por algo (clima, cliente pidió mover fecha)
  // cancelada  = no va; libera las unidades
  estado: { type: String, enum: ['pendiente', 'confirmada', 'completada', 'pausada', 'cancelada'], default: 'pendiente', index: true },

  // Quién y cuándo aprobó el pago, para tener rastro.
  aprobadaPor: { type: String, default: '' },
  aprobadaEn: { type: Date },

  whatsappEnviado: { type: Boolean, default: false },
  emailEnviado: { type: Boolean, default: false },

  creadaEn: { type: Date, default: Date.now },
  actualizadaEn: { type: Date, default: Date.now }
});

reservaSchema.index({ fecha: 1, horario: 1, estado: 1 });

// La misma máquina física no se puede vender dos veces el mismo día.
// Índice multiclave sobre el arreglo: Mongo indexa cada unidad por
// separado, así que el unique aplica máquina por máquina.
//
// El filtro parcial incluye 'pendiente' a propósito: una reserva recién
// mandada todavía no está pagada, pero ya debe apartar la máquina — si no,
// dos personas podrían reservar el mismo Maverick mientras ambas esperan
// que se valide su transferencia. Al cancelar, la unidad se libera sola.
reservaSchema.index(
  { 'unidades.codigo': 1, fecha: 1 },
  { unique: true, partialFilterExpression: { estado: { $in: ['pendiente', 'confirmada'] } } }
);

reservaSchema.pre('save', function (next) {
  this.actualizadaEn = new Date();
  next();
});

// Lo que le falta por pagar al cliente.
reservaSchema.virtual('saldo').get(function () {
  return Math.max(0, (this.montoTotal || 0) - (this.montoPagado || 0));
});

reservaSchema.set('toJSON', { virtuals: true });
reservaSchema.set('toObject', { virtuals: true });

export default mongoose.model('Reserva', reservaSchema);
