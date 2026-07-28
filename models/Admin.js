import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true },
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: true },
  rol: { type: String, enum: ['owner', 'manager'], default: 'manager' },
  activo: { type: Boolean, default: true },
  creadoEn: { type: Date, default: Date.now },
  ultimoAcceso: { type: Date, default: Date.now }
});

// Hash password antes de guardar
adminSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Método para comparar contraseñas
adminSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.passwordHash);
};

export default mongoose.model('Admin', adminSchema);
