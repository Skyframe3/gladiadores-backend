import express from 'express';
import Ruta from '../models/Ruta.js';
import Unidad from '../models/Unidad.js';

const router = express.Router();

// Respuestas predefinidas del bot
const respuestas = {
  ubicacion: {
    patron: /donde|ubicacion|localiz|direccion|map|gps|localización/i,
    respuesta: `📍 **¿Dónde estamos?**\n\nGladiadores Off Road está ubicado en Chignahuapan, Puebla, México.\n\n📞 WhatsApp: +52 (your-number)\n🌐 Web: www.gladiadoresoffroad.com\n\n¡Síguenos en nuestras redes sociales!`
  },
  horarios: {
    patron: /horario|hora de salida|salimos a que hora|cuando empez/i,
    respuesta: `⏰ **Horarios de Salida**\n\nNuestras rutas están disponibles en los siguientes horarios:\n• 09:00 AM\n• 01:00 PM (13:00)\n\n¿En qué fecha te gustaría reservar?`
  },
  contacto: {
    patron: /contacto|llamada|telefono|numero|whatsapp|correo|email/i,
    respuesta: `📞 **Contacto Directo**\n\nWhatsApp: +52 (your-number)\nCorreo: contact@gladiadoresoffroad.com\n\n¡Estamos aquí para ayudarte!`
  },
  unidades: {
    patron: /unidad|maquina|atv|quad|cuatrimoto|maverick|commander|vehicle|tipo de vehiculo/i,
    respuesta: null // Dinámico
  },
  rutas: {
    patron: /ruta|tour|experiencia|aventura|que hacemos|que ofrecen|actividad|qué tours/i,
    respuesta: null // Dinámico
  },
  precio: {
    patron: /precio|costo|cuanto cuesta|tarifa|valor|paga|cuanto vale|presupuesto/i,
    respuesta: null // Dinámico
  },
  reservar: {
    patron: /reserv|quiero ir|quiero una|agendar|book|booking|reserve/i,
    respuesta: `✅ **¿Listo para Reservar?**\n\n1. Elige tu ruta favorita\n2. Selecciona fecha y horario\n3. Elige tu unidad\n4. Completa tus datos\n5. ¡Paga y confirma!\n\nO contáctanos por WhatsApp para una reserva personalizada.`
  },
  saludo: {
    patron: /hola|buenos|hi|hey|ola|qué tal|como estás|holaaa/i,
    respuesta: `👋 **¡Hola! Bienvenido a Gladiadores Off Road**\n\n¿En qué puedo ayudarte hoy?\n\n📌 Puedo contarte sobre:\n• Nuestras **rutas y tours**\n• **Precios y disponibilidad**\n• Nuestras **unidades** (Cuatrimotos, Commanders, Mavericks)\n• Cómo **reservar**\n• **Dónde estamos**\n\n¿Qué te interesa?`
  },
  defecto: {
    respuesta: `🤔 No entendí bien tu pregunta.\n\nPuedo ayudarte con:\n• 🗺️ Nuestras **rutas**\n• 💰 **Precios**\n• 🚗 Tipos de **unidades**\n• 📅 **Cómo reservar**\n• 📍 **Dónde estamos**\n• ☎️ **Contacto**\n\n¿Qué necesitas?`
  }
};

// POST /api/chatbot — procesa un mensaje del usuario
router.post('/', async (req, res) => {
  try {
    const { mensaje } = req.body;

    if (!mensaje || typeof mensaje !== 'string') {
      return res.status(400).json({ error: 'Mensaje inválido' });
    }

    const textoLimpio = mensaje.trim().toLowerCase();

    // Evaluar patrones en orden: saludo, ubicación, contacto, etc.
    let respuesta = null;

    // 1. Saludo
    if (respuestas.saludo.patron.test(textoLimpio)) {
      respuesta = respuestas.saludo.respuesta;
    }
    // 2. Ubicación
    else if (respuestas.ubicacion.patron.test(textoLimpio)) {
      respuesta = respuestas.ubicacion.respuesta;
    }
    // 3. Horarios
    else if (respuestas.horarios.patron.test(textoLimpio)) {
      respuesta = respuestas.horarios.respuesta;
    }
    // 4. Contacto
    else if (respuestas.contacto.patron.test(textoLimpio)) {
      respuesta = respuestas.contacto.respuesta;
    }
    // 5. Rutas
    else if (respuestas.rutas.patron.test(textoLimpio)) {
      const rutas = await Ruta.find({ activo: true }).sort({ orden: 1 });
      const listaRutas = rutas
        .map((r, i) => `${i + 1}. **${r.name}** (${r.dur}) - $${r.units?.[0]?.price || 'Ver'}`)
        .join('\n');
      respuesta = `🗺️ **Nuestras ${rutas.length}+ Rutas**\n\n${listaRutas}\n\n¿Cuál te atrae? 😊`;
    }
    // 6. Unidades
    else if (respuestas.unidades.patron.test(textoLimpio)) {
      const unidades = await Unidad.find({ activo: true }).sort({ orden: 1 });
      const listaUnidades = unidades
        .map(u => `🚗 **${u.nombreCompleto}** - ${u.plazas} plazas`)
        .join('\n');
      respuesta = `🚙 **Nuestra Flota**\n\n${listaUnidades}\n\n¿Cuál te gustaría para tu aventura?`;
    }
    // 7. Precios
    else if (respuestas.precio.patron.test(textoLimpio)) {
      const rutas = await Ruta.find({ activo: true }).sort({ orden: 1 });
      const preciosUnicos = new Map();
      rutas.forEach(r => {
        r.units?.forEach(u => {
          const clave = `${u.type}-${u.seats}`;
          if (!preciosUnicos.has(clave)) {
            preciosUnicos.set(clave, { type: u.type, seats: u.seats, prices: new Set() });
          }
          preciosUnicos.get(clave).prices.add(u.price);
        });
      });

      const listaPrecios = Array.from(preciosUnicos.values())
        .map(p => {
          const tipos = { cuatrimoto: 'Cuatrimoto', commander: 'Commander Max', maverick: 'Maverick X3' };
          const precios = Array.from(p.prices).sort((a, b) => a - b);
          return `• **${tipos[p.type]}** (${p.seats}p): $${precios[0]}${precios.length > 1 ? `-$${precios[precios.length - 1]}` : ''}`;
        })
        .join('\n');

      respuesta = `💰 **Nuestros Precios**\n\n${listaPrecios}\n\n¿Quieres reservar? 😊`;
    }
    // 8. Reservar
    else if (respuestas.reservar.patron.test(textoLimpio)) {
      respuesta = respuestas.reservar.respuesta;
    }
    // 9. Defecto
    else {
      respuesta = respuestas.defecto.respuesta;
    }

    // Convertir Markdown básico a formato simple para chat
    const respuestaFormato = respuesta
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/[\*_]/g, '');

    res.json({
      ok: true,
      mensaje: textoLimpio,
      respuesta: respuestaFormato,
      tipo: 'info'
    });
  } catch (err) {
    console.error('Error en chatbot:', err.message);
    res.status(500).json({ error: 'Error al procesar tu mensaje' });
  }
});

export default router;
