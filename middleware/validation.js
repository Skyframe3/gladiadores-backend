const sanitizeString = (str) => {
  if (!str) return '';
  // Remover caracteres peligrosos: permitir solo letras, números, espacios, acentos y algunos símbolos seguros
  return String(str)
    .replace(/[<>\"'`&=;()[\]{}]/g, '') // Remover caracteres HTML/script/inyección
    .replace(/\s+/g, ' ') // Normalizar espacios múltiples
    .trim();
};

// Las 5 categorías reales de la flotilla. Cualquier otro valor de
// categoriaId es rechazado: es lo único que le permite al cliente elegir
// qué máquina se le asigna, el resto (cuál apodo, el precio) lo decide
// el servidor.
const CATEGORIAS_VALIDAS = ['cuatrimoto-2', 'commander-2', 'commander-4', 'maverick-2', 'maverick-4'];

export const validateReserva = (req, res, next) => {
  const { nombre, email, whatsapp, ruta, rutaId, categoriaId, horario, fecha, personas, modoPago } = req.body;

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

  // Validar ruta (nombre para mostrar, informativo)
  const rutaRegex = /^[a-záéíóúñ\s\-']{3,100}$/i;
  if (!ruta || !rutaRegex.test(ruta.trim())) {
    return res.status(400).json({ error: 'ruta: solo letras, números, espacios y guiones (3-100 caracteres)' });
  }
  req.body.ruta = ruta.trim();

  // rutaId es el que de verdad usa el servidor para buscar la ruta real
  if (!Number.isInteger(rutaId)) {
    return res.status(400).json({ error: 'rutaId: requerido' });
  }

  // categoriaId decide qué tipo de máquina se le va a asignar. El precio y
  // la unidad exacta (apodo) los calcula el servidor, nunca vienen del cliente.
  if (!categoriaId || !CATEGORIAS_VALIDAS.includes(categoriaId)) {
    return res.status(400).json({ error: `categoriaId: debe ser una de ${CATEGORIAS_VALIDAS.join(', ')}` });
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

  // Validar personas (cuántos van en el vehículo, no asientos sueltos)
  if (!Number.isInteger(personas) || personas < 1 || personas > 12) {
    return res.status(400).json({ error: 'personas: debe ser un número entero de 1 a 12' });
  }

  // Validar modoPago
  if (modoPago !== undefined && !['anticipo', 'completo'].includes(modoPago)) {
    return res.status(400).json({ error: 'modoPago: debe ser "anticipo" o "completo"' });
  }

  // El precio (monto y montoTotal) no se valida aquí: el servidor lo calcula
  // él mismo a partir de la tarifa real de la ruta, nunca confía en lo que
  // mande el cliente. Ver routes/reservas.js.

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
