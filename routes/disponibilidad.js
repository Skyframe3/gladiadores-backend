import express from 'express';
import Unidad from '../models/Unidad.js';
import Reserva from '../models/Reserva.js';
import Ruta from '../models/Ruta.js';

const router = express.Router();

// GET /api/disponibilidad?fecha=2026-08-10&hora=09:00&ruta=1 (ruta es opcional)
// Retorna: lista de unidades disponibles con precios de la ruta (si aplica)
router.get('/', async (req, res) => {
  try {
    const { fecha, hora, ruta } = req.query;

    // Validar fecha y hora
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida (usa YYYY-MM-DD)' });
    }
    if (!hora || !/^\d{1,2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: 'Hora inválida (usa HH:MM)' });
    }

    // Conversión: la fecha de reserva es el día de la salida
    const fechaObj = new Date(fecha + 'T00:00:00Z');
    const [horas, minutos] = hora.split(':').map(Number);

    // Buscar todas las reservas que encajen en este día/hora
    // (simplificado: cualquier reserva en ese día se considera conflictiva para ese horario)
    const reservasEnDia = await Reserva.find({
      fecha: {
        $gte: new Date(fecha + 'T00:00:00Z'),
        $lt: new Date(new Date(fecha).getTime() + 86400000) // +1 día
      }
    });

    // Extraer IDs de unidades ya reservadas en este día
    const unidadesReservadas = new Set(reservasEnDia.map(r => r.unidad?.id).filter(Boolean));

    // Obtener todas las unidades activas
    let unidades = await Unidad.find({ activo: true }).sort({ orden: 1 });

    // Si se especifica ruta, obtener precios de esa ruta
    let preciosPorTipo = {};
    if (ruta) {
      const rutaObj = await Ruta.findOne({ rid: Number(ruta) });
      if (rutaObj) {
        // Construir mapa de precios: tipo-plazas → precio
        rutaObj.units.forEach(u => {
          const tipoId = `${u.type}-${u.seats}`;
          preciosPorTipo[tipoId] = u.price;
        });
      }
    }

    // Armar respuesta
    const disponibles = unidades
      .filter(u => !unidadesReservadas.has(u._id.toString()))
      .map(u => ({
        id: u._id.toString(),
        codigo: u.codigo,
        apodo: u.apodo,
        tipo: u.tipo,
        plazas: u.plazas,
        tipoId: u.tipoId,
        nombreCompleto: u.nombreCompleto,
        precio: preciosPorTipo[u.tipoId] || null,
        imagen: u.imagen
      }));

    res.json({
      ok: true,
      fecha,
      hora,
      ruta: ruta ? Number(ruta) : null,
      total: disponibles.length,
      unidades: disponibles
    });
  } catch (err) {
    console.error('Error en disponibilidad:', err.message);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
});

export default router;
