import express from 'express';
import Unidad from '../models/Unidad.js';
import Reserva from '../models/Reserva.js';
import Ruta from '../models/Ruta.js';

const router = express.Router();

// Reservas de un día bloquean la máquina física completa ese día: dos
// salidas distintas el mismo día ya la dejarían sucia/sin combustible
// para la siguiente, así que no vale la pena distinguir por hora.
export async function unidadesOcupadasEnFecha(fecha) {
  const inicio = new Date(fecha + 'T00:00:00Z');
  const fin = new Date(inicio.getTime() + 86400000);
  // 'pausada' también aparta: la reserva sigue viva, solo está en espera.
  const reservas = await Reserva.find({
    fecha: { $gte: inicio, $lt: fin },
    estado: { $in: ['pendiente', 'confirmada', 'pausada'] }
  }).select('unidades.codigo');
  const ocupadas = new Set();
  reservas.forEach(r => (r.unidades || []).forEach(u => u.codigo && ocupadas.add(u.codigo)));
  return ocupadas;
}

// GET /api/disponibilidad?fecha=2026-08-10&hora=09:00&ruta=1 (ruta es opcional)
// Retorna las unidades físicas libres ese día, con su precio si se pasó ruta.
router.get('/', async (req, res) => {
  try {
    const { fecha, hora, ruta } = req.query;

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({ error: 'Fecha inválida (usa YYYY-MM-DD)' });
    }
    if (hora && !/^\d{1,2}:\d{2}$/.test(hora)) {
      return res.status(400).json({ error: 'Hora inválida (usa HH:MM)' });
    }

    // Detalle de qué reserva ocupa cada unidad ese día (para el panel del
    // dueño: "¿quién tiene el Commander el 15 de diciembre?").
    const inicio = new Date(fecha + 'T00:00:00Z');
    const fin = new Date(inicio.getTime() + 86400000);
    const reservasDelDia = await Reserva.find({
      fecha: { $gte: inicio, $lt: fin },
      estado: { $in: ['pendiente', 'confirmada', 'pausada'] }
    }).select('unidades folio ruta horario estado cliente.nombre');
    const detallePorCodigo = {};
    reservasDelDia.forEach(r => {
      (r.unidades || []).forEach(u => {
        if (u.codigo) detallePorCodigo[u.codigo] = { folio: r.folio, ruta: r.ruta, horario: r.horario, estado: r.estado, cliente: r.cliente?.nombre };
      });
    });
    const ocupadas = new Set(Object.keys(detallePorCodigo));
    const unidades = await Unidad.find().sort({ orden: 1 });

    // Precio por categoría: el id de la categoría de la ruta (ej. "maverick-4")
    // coincide 1:1 con el tipoId de la unidad física del mismo tipo.
    let preciosPorCategoria = {};
    let rutaObj = null;
    if (ruta) {
      rutaObj = await Ruta.findOne({ rid: Number(ruta) });
      if (rutaObj) {
        rutaObj.units.forEach(u => { preciosPorCategoria[u.id] = { price: u.price, activo: u.activo }; });
      }
    }

    const disponibles = unidades
      .filter(u => u.activo && !ocupadas.has(u.codigo))
      .filter(u => !rutaObj || preciosPorCategoria[u.tipoId]?.activo) // si hay ruta, solo categorías que vende esa ruta
      .map(u => ({
        id: u._id.toString(),
        codigo: u.codigo,
        apodo: u.apodo,
        tipo: u.tipo,
        plazas: u.plazas,
        tipoId: u.tipoId,
        nombreCompleto: u.nombreCompleto,
        precio: preciosPorCategoria[u.tipoId]?.price ?? null,
        imagen: u.imagen
      }));

    // Conteo por categoría: lo que de verdad le importa al cliente
    // ("¿hay Maverick de 4 libre?"), no la lista de apodos uno por uno.
    const porCategoria = {};
    disponibles.forEach(u => {
      if (!porCategoria[u.tipoId]) porCategoria[u.tipoId] = { tipoId: u.tipoId, nombre: u.nombreCompleto.split(' · ')[0], plazas: u.plazas, precio: u.precio, libres: 0 };
      porCategoria[u.tipoId].libres++;
    });

    // Roster completo (libres, ocupadas y de mantenimiento) para el panel
    // del dueño. No se usa en la reserva del cliente, solo en el admin.
    const todas = unidades.map(u => ({
      numero: u.orden,
      codigo: u.codigo,
      apodo: u.apodo,
      tipo: u.tipo,
      plazas: u.plazas,
      tipoId: u.tipoId,
      nombreCompleto: u.nombreCompleto,
      activo: u.activo,
      libre: u.activo && !ocupadas.has(u.codigo),
      ocupacion: detallePorCodigo[u.codigo] || null
    }));

    res.json({
      ok: true,
      fecha,
      hora: hora || null,
      ruta: ruta ? Number(ruta) : null,
      total: disponibles.length,
      unidades: disponibles,
      categorias: Object.values(porCategoria),
      todas
    });
  } catch (err) {
    console.error('Error en disponibilidad:', err.message);
    res.status(500).json({ error: 'Error al verificar disponibilidad' });
  }
});

export default router;
