// Crea el acceso de MOSTRADOR (rol "staff").
//
// Esa persona entra al mismo panel pero solo ve la pestaña de Reservas:
// puede ver las del día (quién rentó, qué unidades, cuánto falta por
// pagar) y mover el estado a Terminada o Pausada. No ve precios del
// catálogo, ni la flotilla, ni la configuración, y no puede aprobar pagos.
//
// USO:
//   node scripts/crear-staff.js correo@ejemplo.com "ContraseñaSegura" "Nombre Persona"

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/Admin.js';

dotenv.config();

const [email, password, nombre] = process.argv.slice(2);

if (!email || !password) {
  console.error('Uso: node scripts/crear-staff.js correo@ejemplo.com "Contraseña" "Nombre"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });

  const yaExiste = await Admin.findOne({ email: email.toLowerCase() });
  if (yaExiste) {
    console.error(`Ya existe una cuenta con ${email} (rol: ${yaExiste.rol}).`);
    process.exit(1);
  }

  await Admin.create({
    email: email.toLowerCase(),
    passwordHash: password,          // el modelo lo hashea solo al guardar
    nombre: nombre || 'Mostrador',
    rol: 'staff'
  });

  console.log(`✓ Acceso de mostrador creado para ${email}`);
  console.log('  Entra en https://www.gladiadoresoffroad.com/admin');
  console.log('  Solo verá la pestaña de Reservas.');

  await mongoose.disconnect();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
