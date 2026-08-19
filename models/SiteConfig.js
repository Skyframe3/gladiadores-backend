import mongoose from 'mongoose';

// Configuración global del sitio. Documento único (findOne sin filtro).
const siteConfigSchema = new mongoose.Schema({
  mantenimiento: { type: Boolean, default: false },
  actualizadoEn: { type: Date, default: Date.now },
  actualizadoPor: { type: String, default: '' }
});

siteConfigSchema.statics.obtener = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

export default mongoose.model('SiteConfig', siteConfigSchema);
