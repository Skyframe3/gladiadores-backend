// Enciende las 5 categorías en las rutas que tienen flyer.
//
// Al migrar los precios se respetaron los switches que ya traía el panel, y
// varios estaban apagados de antes: la cuatrimoto no salía en 7 de 10 rutas,
// el Maverick X3 MAX faltaba en Río y Calera, y el Commander Max en Quexnol.
// Los flyers de julio 2026 anuncian las tres familias en todas las rutas, así
// que el catálogo tiene que decir lo mismo que las lonas impresas.
//
// Es de una sola pasada: después de correrlo, apagar una unidad se hace desde
// el panel como siempre. No lo vuelvas a correr si apagaste algo a propósito.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';

dotenv.config();

const CON_FLYER = [1, 2, 3, 4, 5, 6, 7, 8, 10];

async function encender() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  let tocadas = 0;
  for (const rid of CON_FLYER) {
    const ruta = await Ruta.findOne({ rid });
    if (!ruta) { console.log(`! rid ${rid}: no existe`); continue; }

    const apagadas = ruta.units.filter(u => !u.activo).map(u => u.id);
    if (!apagadas.length) { console.log(`-  ${ruta.name}: ya estaban todas encendidas`); continue; }

    ruta.units.forEach(u => { u.activo = true; });
    ruta.actualizadaEn = new Date();
    await ruta.save();
    tocadas++;
    console.log(`OK ${ruta.name}: encendidas ${apagadas.join(', ')}`);
  }

  console.log(`\nRutas modificadas: ${tocadas}`);
  await mongoose.connection.close();
  process.exit(0);
}

encender().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
