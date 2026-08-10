import mongoose from 'mongoose';

// Configuración del agente de chat. Documento único (findOne sin filtro):
// no hay múltiples agentes, solo el que atiende el sitio.
const agenteConfigSchema = new mongoose.Schema({
  activo: { type: Boolean, default: true },
  // Texto libre que el dueño puede editar: promociones vigentes, tono,
  // cosas que el agente debe evitar decir. Se inyecta en el prompt del
  // sistema en cada conversación.
  instrucciones: { type: String, default: '', maxlength: 2000 },
  actualizadoEn: { type: Date, default: Date.now }
});

agenteConfigSchema.statics.obtener = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

export default mongoose.model('AgenteConfig', agenteConfigSchema);
