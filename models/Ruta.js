import mongoose from 'mongoose';

// Precio de la ruta para una configuración de unidad (maverick-4,
// commander-2...). La flota es global; lo que cambia por ruta es el precio.
const precioSchema = new mongoose.Schema({
  tipoId: { type: String, required: true },
  precio: { type: Number, required: true, min: 0 },
  activo: { type: Boolean, default: true }   // permite no ofrecer un tipo en esta ruta
}, { _id: false });

// Horario con switch propio para poder apagar una salida sin borrarla
const horarioSchema = new mongoose.Schema({
  hora: { type: String, required: true },
  activo: { type: Boolean, default: true }
}, { _id: false });

const rutaSchema = new mongoose.Schema({
  rid: { type: Number, required: true, unique: true },  // id que usa el frontend
  name: { type: String, required: true },
  tag: { type: String, default: '' },
  exp: { type: String, default: 'panoramica' },
  img: { type: String, default: '' },
  gal: { type: Number, default: 0 },
  acc: { type: String, default: '#52A030' },
  diffC: { type: String, default: '#30B030' },
  diff: { type: String, default: 'MODERADA' },
  dur: { type: String, default: '' },
  dist: { type: String, default: '' },
  desc: { type: String, default: '' },
  terrain: { type: [String], default: [] },
  horarios: { type: [horarioSchema], default: [] },
  precios: { type: [precioSchema], default: [] },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  actualizadaEn: { type: Date, default: Date.now }
});

// Forma que espera el frontend: horarios y precios inactivos ya filtrados.
// Las unidades no vienen aquí; se piden por fecha y horario a
// /api/disponibilidad, porque la flota se comparte entre todas las rutas.
rutaSchema.methods.toPublico = function () {
  return {
    id: this.rid,
    name: this.name,
    tag: this.tag,
    exp: this.exp,
    img: this.img,
    gal: this.gal,
    acc: this.acc,
    diffC: this.diffC,
    diff: this.diff,
    dur: this.dur,
    dist: this.dist,
    desc: this.desc,
    terrain: this.terrain,
    horarios: this.horarios.filter(h => h.activo).map(h => h.hora),
    precios: this.precios.filter(p => p.activo).map(p => ({
      tipoId: p.tipoId,
      precio: p.precio
    }))
  };
};

// Precio de esta ruta para una configuración, o null si no se ofrece
rutaSchema.methods.precioDe = function (tipoId) {
  const p = this.precios.find(x => x.tipoId === tipoId && x.activo);
  return p ? p.precio : null;
};

export default mongoose.model('Ruta', rutaSchema);
