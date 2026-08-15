// Las 10 rutas amanecieron con la portada (img) vacía en la base — el seed
// original sí las traía, así que en algún punto algo las vació. Este script
// las restaura desde el mapeo del catálogo de respaldo del sitio (lo que se
// veía en producción antes de que el catálogo viniera del API), que es la
// referencia aprobada por el dueño.
//
// Solo rellena portadas VACÍAS: si el dueño ya subió una foto desde el
// panel, no se toca. Idempotente.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';

dotenv.config();

const PORTADAS = {
  1: 'img/i15.jpg',
  2: 'img/i5.jpg',
  3: 'img/i13.jpg',
  4: 'img/i14.jpg',
  5: 'img/i5.jpg',
  6: 'img/i15.jpg',
  7: 'img/i14.jpg',
  8: 'img/i13.jpg',
  9: 'img/i5.jpg',
  10: 'img/i5.jpg'
};

async function restaurar() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  let tocadas = 0;
  for (const [rid, img] of Object.entries(PORTADAS)) {
    const ruta = await Ruta.findOne({ rid: Number(rid) });
    if (!ruta) { console.log(`! rid ${rid}: no existe`); continue; }
    if (ruta.img) { console.log(`-  ${ruta.name}: ya tiene portada (${ruta.img}), no se toca`); continue; }
    ruta.img = img;
    ruta.actualizadaEn = new Date();
    await ruta.save();
    tocadas++;
    console.log(`OK ${ruta.name}: portada restaurada -> ${img}`);
  }

  console.log(`\nRutas restauradas: ${tocadas}`);
  await mongoose.connection.close();
  process.exit(0);
}

restaurar().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
