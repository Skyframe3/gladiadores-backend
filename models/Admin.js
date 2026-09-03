import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true, lowercase: true },
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: true },
  rol: { type: String, enum: ['owner', 'manager', 'staff'], default: 'manager' },
  activo: { type: Boolean, default: true },

  // Segundo factor (TOTP, compatible con Google Authenticator y Authy).
  // El secreto se genera al iniciar el alta y solo cuenta como activo
  // cuando la persona confirma un código válido.
  totpSecret: { type: String, select: false },
  totpActivo: { type: Boolean, default: false },
  // Códigos de un solo uso por si pierde el teléfono. Se guardan hasheados.
  codigosRespaldo: { type: [String], select: false, default: [] },

  // Bloqueo tras intentos fallidos
  intentosFallidos: { type: Number, default: 0 },
  // El segundo factor lleva su propia cuenta: quien ya pasó la contraseña
  // y falla el código repetidas veces también tiene que quedar fuera.
  intentosFallidos2FA: { type: Number, default: 0 },
  bloqueadoHasta: { type: Date },

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
