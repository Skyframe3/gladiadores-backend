import mongoose from 'mongoose';

// Unidad dentro de una ruta: el admin puede cambiarle precio,
// desactivarla completa o bloquear asientos sueltos.
const unidadSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, default: '' },
  seats: { type: Number, required: true, min: 1, max: 12 },
  price: { type: Number, required: true, min: 0 },
  booked: { type: [Number], default: [] },   // asientos bloqueados por el admin
  activo: { type: Boolean, default: true }
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
  units: { type: [unidadSchema], default: [] },
  activo: { type: Boolean, default: true },
  orden: { type: Number, default: 0 },
  actualizadaEn: { type: Date, default: Date.now }
});

// Forma que espera el frontend: horarios y unidades inactivas ya filtradas
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
    units: this.units.filter(u => u.activo).map(u => ({
      id: u.id,
      name: u.name,
      type: u.type,
      seats: u.seats,
      booked: u.booked,
      price: u.price
    }))
  };
};

export default mongoose.model('Ruta', rutaSchema);
