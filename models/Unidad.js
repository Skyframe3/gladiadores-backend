import mongoose from 'mongoose';

// Una máquina física de la flota. Existe una sola vez y sirve para
// todas las rutas: si se aparta el sábado a las 09:00, queda ocupada
// a esa hora sin importar en qué ruta se haya reservado.
const unidadSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },   // MAV4-01
  nombre: { type: String, required: true },                 // Maverick X3
  tipo: { type: String, required: true, enum: ['cuatrimoto', 'maverick', 'commander'] },
  plazas: { type: Number, required: true, min: 1, max: 12 },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  creadaEn: { type: Date, default: Date.now }
});

// Identifica la configuración comercial (maverick-4, commander-2...).
// Las rutas fijan su precio contra esto, no contra la máquina individual.
unidadSchema.virtual('tipoId').get(function () {
  return `${this.tipo}-${this.plazas}`;
});

unidadSchema.set('toJSON', { virtuals: true });
unidadSchema.set('toObject', { virtuals: true });

export const ETIQUETAS_TIPO = {
  cuatrimoto: 'Cuatrimoto',
  maverick: 'Maverick X3',
  commander: 'Commander Max'
};

export const tipoIdLegible = (tipoId) => {
  const [tipo, plazas] = String(tipoId).split('-');
  return `${ETIQUETAS_TIPO[tipo] || tipo} · ${plazas} plazas`;
};

export default mongoose.model('Unidad', unidadSchema);
