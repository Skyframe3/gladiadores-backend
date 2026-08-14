// Borra los bloqueos por asiento (booked) que quedaron del modelo viejo.
// Hoy la renta es por vehículo completo, así que un asiento bloqueado solo
// causa daño: recorta la capacidad y esconde tarifas (Gran Mirador mostraba
// el Maverick MAX como "hasta 2 personas" por culpa de dos asientos
// bloqueados de antes). Idempotente.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ruta from '../models/Ruta.js';

dotenv.config();

async function limpiar() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  const rutas = await Ruta.find();
  let tocadas = 0;
  for (const ruta of rutas) {
    const sucias = ruta.units.filter(u => (u.booked || []).length > 0);
    if (!sucias.length) { console.log(`-  ${ruta.name}: limpia`); continue; }

    sucias.forEach(u => { console.log(`OK ${ruta.name} · ${u.id}: quitados asientos ${u.booked.join(', ')}`); u.booked = []; });
    ruta.actualizadaEn = new Date();
    await ruta.save();
    tocadas++;
  }

  console.log(`\nRutas modificadas: ${tocadas}`);
  await mongoose.connection.close();
  process.exit(0);
}

limpiar().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
