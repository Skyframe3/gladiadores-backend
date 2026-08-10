import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No autorizado: falta token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const ALLOWED_ROLES = ['owner', 'manager'];

export const adminMiddleware = (req, res, next) => {
  if (!ALLOWED_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol admin' });
  }
  next();
};

// Ajustes sensibles (comportamiento del agente, promociones, tono) solo
// para el dueño. Un manager pasa adminMiddleware pero no este.
export const ownerMiddleware = (req, res, next) => {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({ error: 'Acceso denegado: solo el dueño puede modificar esto' });
  }
  next();
};
