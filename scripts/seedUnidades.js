import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Unidad, { FLOTA } from '../models/Unidad.js';

dotenv.config();

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000
    });
    console.log('✅ Conectado a MongoDB');

    // Borrar unidades existentes (opcional, comentar si quieres preservar datos)
    const result = await Unidad.deleteMany({});
    console.log(`🗑️  Borradas ${result.deletedCount} unidades previas`);

    // Insertar flota real
    const insertadas = await Unidad.insertMany(FLOTA);
    console.log(`✅ Insertadas ${insertadas.length} unidades:`);
    insertadas.forEach(u => {
      console.log(`   - ${u.apodo} (${u.codigo}): ${u.tipo} · ${u.plazas} plazas`);
    });

    await mongoose.connection.close();
    console.log('✅ Seed completado');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

seed();
