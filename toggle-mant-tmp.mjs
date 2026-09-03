import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SiteConfig from './models/SiteConfig.js';

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const config = await SiteConfig.obtener();
  config.mantenimiento = true;
  config.actualizadoEn = new Date();
  config.actualizadoPor = 'uriel (directo por Claude, panel no accesible en el momento)';
  await config.save();
  console.log('mantenimiento ->', config.mantenimiento);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e.message); process.exit(1); });
