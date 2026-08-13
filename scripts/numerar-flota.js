// Le pone número a cada máquina de la flota: la 1 y la 2 son las motos y de
// ahí se sigue hasta la 12, agrupadas por familia. Así el dueño y los guías
// pueden decir "la 7 está ocupada" sin depender de acordarse del apodo.
//
// El número vive en el campo `orden`, que además es como se ordena la lista.
// Es idempotente: correrlo dos veces deja lo mismo.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Unidad, { FLOTA } from '../models/Unidad.js';

dotenv.config();

async function numerar() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  let cambiadas = 0, iguales = 0, faltantes = [];

  for (const maquina of FLOTA) {
    const unidad = await Unidad.findOne({ codigo: maquina.codigo });
    if (!unidad) { faltantes.push(maquina.codigo); continue; }

    if (unidad.orden === maquina.orden && unidad.apodo === maquina.apodo) {
      console.log(`-  ${String(maquina.orden).padStart(2)} · ${maquina.apodo}: sin cambios`);
      iguales++;
      continue;
    }

    const antes = `${unidad.orden} · ${unidad.apodo}`;
    unidad.orden = maquina.orden;
    unidad.apodo = maquina.apodo;
    await unidad.save();
    console.log(`OK ${String(maquina.orden).padStart(2)} · ${maquina.apodo}   (antes: ${antes})`);
    cambiadas++;
  }

  if (faltantes.length) console.log(`\n! No están en la base: ${faltantes.join(', ')}`);
  console.log(`\nCambiadas: ${cambiadas} · Ya estaban bien: ${iguales}`);
  await mongoose.connection.close();
  process.exit(0);
}

numerar().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
