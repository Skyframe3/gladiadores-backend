import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';

dotenv.config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB conectado');

    const adminData = {
      email: 'axelsperezhernandez@gmail.com',
      passwordHash: 'GladiadoresAdmin2026',
      nombre: 'Axel Pérez',
      rol: 'manager'
    };

    const existe = await Admin.findOne({ email: adminData.email });
    if (existe) {
      console.log('Admin ya existe:', adminData.email);
      process.exit(0);
    }

    const nuevoAdmin = new Admin(adminData);
    await nuevoAdmin.save();

    console.log('Admin creado exitosamente:');
    console.log('   Email:', nuevoAdmin.email);
    console.log('   Nombre:', nuevoAdmin.nombre);
    console.log('   Rol:', nuevoAdmin.rol);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
