// Activa todos los sábados y domingos del resto de 2026 en las 9 rutas
// que tienen flyer. Idempotente: no duplica fechas que ya existan.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';

dotenv.config();

const CON_FLYER = [1, 2, 3, 4, 5, 6, 7, 8, 10];

function finesDeSemana2026() {
  const fechas = [];
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const fin = new Date(2026, 11, 31);
  while (d <= fin) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) {
      const iso = d.toISOString().slice(0, 10);
      fechas.push(iso);
    }
    d.setDate(d.getDate() + 1);
  }
  return fechas;
}

async function activar() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  const fines = finesDeSemana2026();
  console.log(`Fines de semana del resto de 2026: ${fines.length} días`);
  console.log(`  Desde ${fines[0]} hasta ${fines[fines.length - 1]}\n`);

  let tocadas = 0;
  for (const rid of CON_FLYER) {
    const ruta = await Ruta.findOne({ rid });
    if (!ruta) { console.log(`! rid ${rid}: no existe`); continue; }

    const existentes = new Set(ruta.diasActivos || []);
    const nuevos = fines.filter(f => !existentes.has(f));
    if (!nuevos.length) {
      console.log(`-  ${ruta.name}: ya tenía todos los fines de semana`);
      continue;
    }

    ruta.diasActivos = [...new Set([...(ruta.diasActivos || []), ...fines])].sort();
    ruta.actualizadaEn = new Date();
    await ruta.save();
    tocadas++;
    console.log(`OK ${ruta.name}: +${nuevos.length} días (total ${ruta.diasActivos.length})`);
  }

  console.log(`\nRutas modificadas: ${tocadas}`);
  await mongoose.connection.close();
  process.exit(0);
}

activar().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
