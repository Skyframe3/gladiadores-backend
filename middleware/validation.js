const sanitizeString = (str) => {
  if (!str) return '';
  // Remover caracteres peligrosos: permitir solo letras, números, espacios, acentos y algunos símbolos seguros
  return String(str)
    .replace(/[<>\"'`&=;()[\]{}]/g, '') // Remover caracteres HTML/script/inyección
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim();
};

export const validateReserva = (req, res, next) => {
  const { nombre, email, whatsapp, ruta, unidad, horario, fecha, asientos, monto } = req.body;

  // Validar nombre (permitir solo letras, números, espacios, acentos, guiones)
  const nombreRegex = /^[a-záéíóúñ\s\-']{2,100}$/i;
  if (!nombre || !nombreRegex.test(nombre.trim())) {
    return res.status(400).json({ error: 'nombre: solo letras, números, espacios y guiones (2-100 caracteres)' });
  }
  req.body.nombre = nombre.trim();

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

  // Validar ruta
  const rutaRegex = /^[a-záéíóúñ\s\-']{3,100}$/i;
  if (!ruta || !rutaRegex.test(ruta.trim())) {
    return res.status(400).json({ error: 'ruta: solo letras, números, espacios y guiones (3-100 caracteres)' });
  }
  req.body.ruta = ruta.trim();

  // Validar unidad
  const unidadRegex = /^[a-záéíóúñ\s\-'0-9]{2,50}$/i;
  if (!unidad || !unidadRegex.test(unidad.trim())) {
    return res.status(400).json({ error: 'unidad: solo letras, números, espacios y guiones (2-50 caracteres)' });
  }
  req.body.unidad = unidad.trim();

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
