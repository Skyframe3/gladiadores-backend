export const validateReserva = (req, res, next) => {
  const { nombre, email, whatsapp, ruta, unidad, horario, fecha, asientos, monto } = req.body;

  // Validar nombre
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length < 2) {
    return res.status(400).json({ error: 'nombre: mínimo 2 caracteres' });
  }

  // Validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ error: 'email: formato inválido' });
  }

  // Validar WhatsApp (formato internacional +X XXXXXXXXXX)
  const whatsappRegex = /^[0-9]{10,15}$/;
  if (!whatsapp || !whatsappRegex.test(whatsapp.replace(/\D/g, ''))) {
    return res.status(400).json({ error: 'whatsapp: formato inválido' });
  }

  // Validar ruta y unidad
  if (!ruta || typeof ruta !== 'string' || ruta.trim().length < 3) {
    return res.status(400).json({ error: 'ruta: mínimo 3 caracteres' });
  }
  if (!unidad || typeof unidad !== 'string' || unidad.trim().length < 2) {
    return res.status(400).json({ error: 'unidad: mínimo 2 caracteres' });
  }

  // Validar horario (formato HH:MM)
  const horarioRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
  if (!horario || !horarioRegex.test(horario)) {
    return res.status(400).json({ error: 'horario: formato inválido (HH:MM)' });
  }

  // Validar fecha (debe ser fecha válida y en el futuro)
  const fechaObj = new Date(fecha);
  const now = new Date();
  if (isNaN(fechaObj.getTime()) || fechaObj < now) {
    return res.status(400).json({ error: 'fecha: debe ser una fecha futura válida' });
  }

  // Validar asientos (array de números, mínimo 1)
  if (!Array.isArray(asientos) || asientos.length === 0 || !asientos.every(n => Number.isInteger(n) && n > 0)) {
    return res.status(400).json({ error: 'asientos: debe ser array de números positivos' });
  }

  // Validar monto (número positivo, máximo razonable $50,000)
  if (typeof monto !== 'number' || monto <= 0 || monto > 50000) {
    return res.status(400).json({ error: 'monto: debe estar entre $1 y $50,000' });
  }

  next();
};

export const validateEstado = (req, res, next) => {
  const { estado } = req.body;
  const validos = ['confirmada', 'cancelada', 'completada', 'no_show'];

  if (!estado || !validos.includes(estado)) {
    return res.status(400).json({ error: `estado: debe ser uno de ${validos.join(', ')}` });
  }

  next();
};
