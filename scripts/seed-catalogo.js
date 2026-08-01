// Sube el catálogo que estaba escrito a mano en index.html a MongoDB.
// Es idempotente: si la ruta ya existe no la pisa, para no borrar
// los cambios que el admin haya hecho desde el panel.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';

dotenv.config();

const CATALOGO = [
  { rid: 1, name: "Mirador de Cristal", tag: "POPULAR", exp: "panoramica", img: "img/i15.jpg", gal: 5, acc: "#52A030", diffC: "#E8A020", diff: "MODERADA", dur: "3 hrs", dist: "45 km", desc: "Mirador de cristal, parque, cascada y bosque. Perfecta para contemplar y vivir el off road al mismo tiempo.", terrain: ["Mirador", "Cascada", "Bosque"], horarios: ["09:00", "13:00"],
    units: [{ id: "U01", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [1, 3], price: 600 }, { id: "U02", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 550 }] },
  { rid: 2, name: "Ruta Gran Mirador", tag: "EXTREMA", exp: "extrema", img: "img/i5.jpg", gal: 8, acc: "#D46020", diffC: "#E03030", diff: "EXTREMA", dur: "3 hrs", dist: "80 km", desc: "La ruta más extrema. El mejor mirador de la Sierra Norte. Bosque, rocas y subidas que ponen a prueba todo.", terrain: ["Mirador", "Rocas", "Extremo"], horarios: ["09:00", "12:00"],
    units: [{ id: "U03", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [2, 4], price: 900 }] },
  { rid: 3, name: "Ruta del Río", tag: "AVENTURA", exp: "panoramica", img: "img/i13.jpg", gal: 6, acc: "#2090C0", diffC: "#30B030", diff: "MODERADA", dur: "1 hr", dist: "50 km", desc: "Primera experiencia perfecta. Muchos cruces de río, bosque abundante y ambiente familiar. Ideal para todos.", terrain: ["Río", "Bosque", "Familiar"], horarios: ["10:00", "12:00", "14:00", "16:00"],
    units: [{ id: "U04", name: "Outlander ATV", type: "Cuatrimoto 2 plazas", seats: 2, booked: [], price: 700 }, { id: "U05", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [1, 2], price: 650 }] },
  { rid: 4, name: "La Ruta Clásica", tag: "FAMILIAR", exp: "panoramica", img: "img/i14.jpg", gal: 4, acc: "#C09030", diffC: "#30B030", diff: "FÁCIL", dur: "1.5 hrs", dist: "38 km", desc: "La ruta que siempre recomendarán. Cueva, fábrica abandonada, río y senderos. Clásica por algo.", terrain: ["Clásica", "Cueva", "Río"], horarios: ["10:00", "12:00", "14:00", "16:00"],
    units: [{ id: "U06", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 550 }, { id: "U07", name: "Outlander ATV", type: "Cuatrimoto 2 plazas", seats: 2, booked: [], price: 600 }] },
  { rid: 5, name: "Aventura Nocturna", tag: "ESPECIAL", exp: "extrema", img: "img/i5.jpg", gal: 5, acc: "#5B0AB0", diffC: "#8830B0", diff: "MODERADA", dur: "1 hr 50 min", dist: "35 km", desc: "El bosque de noche es otro mundo. Recorrido nocturno con el cielo estrellado como techo y la adrenalina multiplicada.", terrain: ["Nocturno", "Bosque", "Estrellas"], horarios: ["18:00"],
    units: [{ id: "U08", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [], price: 750 }, { id: "U08b", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 700 }] },
  { rid: 6, name: "Luciérnagas", tag: "TEMPORADA", exp: "panoramica", img: "img/i15.jpg", gal: 4, acc: "#206040", diffC: "#20A060", diff: "FÁCIL", dur: "3+ hrs", dist: "25 km", desc: "Una de las experiencias más mágicas de México. Temporada limitada: el bosque se ilumina con miles de luciérnagas.", terrain: ["Luciérnagas", "Bosque", "Temporada"], horarios: ["18:00"],
    units: [{ id: "U09", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 600 }, { id: "U09b", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [], price: 650 }] },
  { rid: 7, name: "Amanecer en la Montaña", tag: "AVENTURA", exp: "panoramica", img: "img/i14.jpg", gal: 6, acc: "#804010", diffC: "#E07020", diff: "AVANZADA", dur: "3+ hrs", dist: "55 km", desc: "Sal antes del alba. Llega al mirador justo cuando el sol rompe el horizonte sobre la Sierra Norte. Imposible de olvidar.", terrain: ["Amanecer", "Montaña", "Paisaje"], horarios: ["05:30"],
    units: [{ id: "U10", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [], price: 800 }, { id: "U10b", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 750 }] },
  { rid: 8, name: "Experiencia Mezcal", tag: "CULTURAL", exp: "panoramica", img: "img/i13.jpg", gal: 5, acc: "#6A3A10", diffC: "#A06020", diff: "MODERADA", dur: "2.5 hrs", dist: "42 km", desc: "Off road y cultura local. Recorre senderos hasta conocer el proceso artesanal del mezcal de la Sierra Norte de Puebla.", terrain: ["Mezcal", "Cultura", "Senderos"], horarios: ["11:00", "15:00"],
    units: [{ id: "U11", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 650 }, { id: "U11b", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [], price: 700 }] },
  { rid: 9, name: "Expedición al Volcán", tag: "ÉPICA", exp: "extrema", img: "img/i5.jpg", gal: 7, acc: "#B02010", diffC: "#E04020", diff: "AVANZADA", dur: "2 hrs", dist: "60 km", desc: "El volcán más cercano a Chignahuapan. Off road de alto nivel con vistas que no tienen comparación en toda la Sierra Norte.", terrain: ["Volcán", "Paisaje", "Extremo"], horarios: ["10:00", "15:00"],
    units: [{ id: "U12", name: "Maverick X3", type: "SSV 4 plazas", seats: 4, booked: [], price: 850 }, { id: "U12b", name: "Commander Max", type: "SSV 6 plazas", seats: 6, booked: [], price: 800 }] }
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  let creadas = 0, existentes = 0;

  for (const [i, r] of CATALOGO.entries()) {
    const yaExiste = await Ruta.findOne({ rid: r.rid });
    if (yaExiste) {
      console.log(`- ${r.name} ya existe, no se toca`);
      existentes++;
      continue;
    }
    await Ruta.create({
      ...r,
      horarios: r.horarios.map(h => ({ hora: h, activo: true })),
      units: r.units.map(u => ({ ...u, activo: true })),
      activo: true,
      orden: i
    });
    console.log(`✅ ${r.name}`);
    creadas++;
  }

  console.log(`\nCreadas: ${creadas} · Ya existían: ${existentes}`);
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
