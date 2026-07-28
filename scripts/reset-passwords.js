import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';

dotenv.config();

const ADMINS = [
  { email: 'urielserranohuerta4@gmail.com', password: 'GladiadoresOwner2026!', nombre: 'Uriel Serrano', rol: 'owner' },
  { email: 'axelsperezhernandez@gmail.com',  password: 'GladiadoresManager26!', nombre: 'Axel Pérez',   rol: 'manager' }
];

async function resetPasswords() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB conectado\n');

  for (const a of ADMINS) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(a.password, salt);

    const resultado = await Admin.findOneAndUpdate(
      { email: a.email },
      { $set: { passwordHash: hash, activo: true, nombre: a.nombre, rol: a.rol } },
      { upsert: true, new: true }
    );

    const ok = await bcrypt.compare(a.password, resultado.passwordHash);
    console.log(`${ok ? '✅' : '❌'} ${a.email}`);
    console.log(`   Contraseña: ${a.password}`);
    console.log(`   Rol: ${resultado.rol}\n`);
  }

  process.exit(0);
}

resetPasswords().catch(err => { console.error('Error:', err.message); process.exit(1); });
