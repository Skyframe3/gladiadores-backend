// Aplica a la base real el índice único parcial que evita vender la misma
// unidad física dos veces el mismo día (ver models/Reserva.js). Antes de
// crearlo, revisa si ya existen reservas activas duplicadas — si las hay,
// MongoDB se niega a construir el índice y hay que arreglarlas primero.
// Seguro de correr más de una vez.
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Reserva from '../models/Reserva.js';

dotenv.config();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('Conectado a MongoDB\n');

  const duplicados = await Reserva.aggregate([
    { $match: { estado: { $ne: 'cancelada' } } },
    { $group: { _id: { unidadCodigo: '$unidadCodigo', fecha: '$fecha' }, folios: { $push: '$folio' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } }
  ]);

  if (duplicados.length) {
    console.log(`! Hay ${duplicados.length} unidad(es) vendidas dos veces el mismo día — revísalas antes de continuar:\n`);
    duplicados.forEach(d => console.log(`  ${d._id.unidadCodigo} · ${d._id.fecha.toISOString().slice(0, 10)} · folios: ${d.folios.join(', ')}`));
    console.log('\nEl índice no se creó. Cancela una de las reservas duplicadas (desde el panel) y vuelve a correr este script.');
    await mongoose.connection.close();
    process.exit(1);
  }

  console.log('Sin duplicados activos. Creando índices...\n');
  await Reserva.syncIndexes();
  const indices = await Reserva.collection.indexes();
  console.log('Índices actuales:');
  indices.forEach(i => console.log(`  ${i.name}${i.unique ? ' (único)' : ''}`));

  await mongoose.connection.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Falló:', err.message);
  process.exit(1);
});
