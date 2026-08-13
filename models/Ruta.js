import mongoose from 'mongoose';

// El precio es por vehículo completo y cambia según cuánta gente va:
// un Commander con 2 personas no cuesta lo mismo que con 4.
const tarifaSchema = new mongoose.Schema({
  personas: { type: Number, required: true, min: 1, max: 12 },
  precio: { type: Number, required: true, min: 0 }
}, { _id: false });

// Unidad dentro de una ruta: el admin puede cambiarle las tarifas,
// desactivarla completa o bloquear asientos sueltos.
const unidadSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  type: { type: String, default: '' },
  seats: { type: Number, required: true, min: 1, max: 12 },
  tarifas: { type: [tarifaSchema], default: [] },
  price: { type: Number, default: 0, min: 0 },  // heredado del esquema por asiento
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
  img: { type: String, default: '' },       // foto de portada
  galeria: { type: [String], default: [] }, // hasta 10 fotos adicionales de la ruta
  video: { type: String, default: '' },     // liga de Instagram o YouTube
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
    galeria: this.galeria,
    video: this.video,
    gal: this.galeria.length || this.gal,
    acc: this.acc,
    diffC: this.diffC,
    diff: this.diff,
    dur: this.dur,
    dist: this.dist,
    desc: this.desc,
    terrain: this.terrain,
    horarios: this.horarios.filter(h => h.activo).map(h => h.hora),
    units: this.units.filter(u => u.activo).map(u => {
      const tarifas = (u.tarifas || [])
        .filter(t => t.precio > 0)
        .sort((a, b) => a.personas - b.personas);
      return {
        id: u.id,
        name: u.name,
        type: u.type,
        seats: u.seats,
        booked: u.booked,
        tarifas: tarifas.map(t => ({ personas: t.personas, precio: t.precio })),
        // precio de entrada, para el "desde $X" de la tarjeta de ruta
        desde: tarifas.length ? tarifas[0].precio : 0,
        // se sigue mandando para que una versión vieja del sitio, publicada
        // antes que esta API, no se quede mostrando precios en cero
        price: u.price
      };
    })
  };
};

export default mongoose.model('Ruta', rutaSchema);
