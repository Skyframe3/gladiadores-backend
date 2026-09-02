import mongoose from 'mongoose';

// Configuración global del sitio. Documento único (findOne sin filtro).
const siteConfigSchema = new mongoose.Schema({
  mantenimiento: { type: Boolean, default: false },
  // Deja ver el sitio y armar la reserva, pero bloquea el paso final de
  // pago — para cuando el sitio ya es público pero Mercado Pago todavía
  // no está conectado. Empieza en true a propósito: hasta que alguien
  // lo apague a mano, nadie puede completar una reserva real.
  reservasPausadas: { type: Boolean, default: true },
  actualizadoEn: { type: Date, default: Date.now },
  actualizadoPor: { type: String, default: '' }
});

siteConfigSchema.statics.obtener = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

export default mongoose.model('SiteConfig', siteConfigSchema);
