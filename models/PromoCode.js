import mongoose from 'mongoose';

const promoCodeSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  porcentaje: { type: Number, required: true, min: 1, max: 100 },
  usosMaximos: { type: Number, required: true, min: 1 },
  usosActuales: { type: Number, default: 0 },
  vigenciaInicio: { type: Date, required: true },
  vigenciaFin: { type: Date, required: true },
  activo: { type: Boolean, default: true },
  creadoPor: { type: String, default: '' },
  creadoEn: { type: Date, default: Date.now }
});

promoCodeSchema.virtual('valido').get(function () {
  const ahora = new Date();
  return this.activo
    && ahora >= this.vigenciaInicio
    && ahora <= this.vigenciaFin
    && this.usosActuales < this.usosMaximos;
});

promoCodeSchema.set('toJSON', { virtuals: true });

export default mongoose.model('PromoCode', promoCodeSchema);
