import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;

console.log('Testing MongoDB connection...');
console.log('URI format:', uri ? uri.replace(/:[^:/@]+@/, ':****@') : 'NO URI');
console.log('');

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  maxPoolSize: 3
})
.then(async () => {
  console.log('✅ CONECTADO');
  const admin = await mongoose.connection.db.admin();
  const ping = await admin.ping();
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Ping:', ping);
  console.log('Collections:', collections.map(c => c.name).join(', '));
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.log('❌ ERROR:', err.message);
  console.log('Code:', err.code);
  console.log('Name:', err.name);
  if (err.reason) console.log('Reason:', err.reason);
  process.exit(1);
});

// Timeout fallback
setTimeout(() => {
  console.log('❌ TIMEOUT after 65 seconds');
  process.exit(1);
}, 65000);
