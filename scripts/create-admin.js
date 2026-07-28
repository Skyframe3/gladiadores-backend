import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';

dotenv.config();

async function createAdmin() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB conectado');

    // Datos del admin
    const adminData = {
      email: 'urielserranohuerta4@gmail.com',
      passwordHash: 'Pruebadepagina',
      nombre: 'Uriel Serrano',
      rol: 'owner' // Owner = control total
    };

    // Verificar si ya existe
    const existe = await Admin.findOne({ email: adminData.email });
    if (existe) {
      console.log('⚠️ Admin ya existe:', adminData.email);
      process.exit(0);
    }

    // Crear admin
    const nuevoAdmin = new Admin(adminData);
    await nuevoAdmin.save();

    console.log('✅ Admin creado exitosamente:');
    console.log('   Email:', nuevoAdmin.email);
    console.log('   Nombre:', nuevoAdmin.nombre);
    console.log('   Rol:', nuevoAdmin.rol);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

createAdmin();
