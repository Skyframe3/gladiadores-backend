import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import Ruta from '../models/Ruta.js';
import Unidad from '../models/Unidad.js';
import AgenteConfig from '../models/AgenteConfig.js';

const router = express.Router();

const WHATSAPP = '+52 797 100 1929';
const WHATSAPP_LINK = 'https://wa.me/527971001929';
const MODELO = 'claude-haiku-4-5-20251001';
const MAX_TURNOS = 20;
const MAX_CHARS_MENSAJE = 600;

async function construirPrompt() {
  const [rutas, unidades, config] = await Promise.all([
    Ruta.find({ activo: true }).sort({ orden: 1, rid: 1 }),
    Unidad.find({ activo: true }).sort({ orden: 1 }),
    AgenteConfig.obtener()
  ]);

  const listaRutas = rutas.map(r => {
    const precios = r.units.filter(u => u.activo).map(u => u.price);
    const desde = precios.length ? Math.min(...precios) : null;
    const horarios = r.horarios.filter(h => h.activo).map(h => h.hora).join(', ') || 'consultar';
    return `- ${r.name} (${r.dur || 'duración por confirmar'}): desde $${desde ?? '—'} MXN por asiento. Horarios: ${horarios}.`;
  }).join('\n') || 'Sin rutas activas en este momento.';

  const conteoTipos = {};
  unidades.forEach(u => {
    const clave = u.nombreCompleto;
    conteoTipos[clave] = (conteoTipos[clave] || 0) + 1;
  });
  const listaFlota = Object.entries(conteoTipos).map(([nombre, n]) => `- ${nombre}: ${n} unidad${n > 1 ? 'es' : ''}`).join('\n') || 'Flota no disponible en este momento.';

  return `Eres el agente de atención de Gladiadores Off Road, una empresa de experiencias turísticas guiadas en vehículos 4x4 en Chignahuapan, Puebla, México.

FRASE DE MARCA: "No rentamos vehículos. Creamos experiencias que se conducen."

RUTAS DISPONIBLES AHORA:
${listaRutas}

FLOTILLA (12 unidades propias, 100% Can-Am, guías profesionales en todos los recorridos):
${listaFlota}

UBICACIÓN: Base Gladiadores, Paseo de la Laguna, Chignahuapan, Puebla.
CONTACTO HUMANO: WhatsApp ${WHATSAPP}.

CÓMO RESERVAR: el cliente elige ruta → fecha y horario → vehículo → paga anticipo o completo con Mercado Pago, todo desde la página.

${config.instrucciones ? `INSTRUCCIONES ADICIONALES DEL DUEÑO (síguelas con prioridad):\n${config.instrucciones}\n` : ''}
CÓMO RESPONDER:
- Español de México, cercano y entusiasta, sin exagerar. Sin emojis en exceso (máximo uno por mensaje si aporta).
- Respuestas cortas: 2 a 4 frases, es un chat, no un correo.
- Nunca inventes precios, rutas ni horarios que no estén arriba. Si no tienes el dato, dilo y ofrece pasar con un asesor.
- Tu objetivo es ayudar a decidir y AVANZAR hacia la reserva: sugiere la ruta que mejor calce con lo que pide el cliente y anímalo a reservar en la página.
- Si el cliente ya quiere pagar, cambiar una reserva existente, pedir factura, quejarse o pide hablar con una persona, dile con calidez que lo mejor es continuar por WhatsApp (${WHATSAPP}) y ofrécele el enlace: ${WHATSAPP_LINK}
- No des consejos médicos ni de seguridad más allá de lo que sabrías como parte del equipo de turismo de aventura.`;
}

// POST /api/chatbot/mensaje — el agente conversa con el cliente
router.post('/mensaje', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'Agente no disponible', whatsapp: WHATSAPP_LINK });
    }

    const config = await AgenteConfig.obtener();
    if (!config.activo) {
      return res.json({
        ok: true,
        respuesta: `En este momento te atiendo mejor por WhatsApp: ${WHATSAPP}. ¡Escríbeme!`,
        whatsapp: WHATSAPP_LINK
      });
    }

    const { conversacion } = req.body;
    if (!Array.isArray(conversacion) || conversacion.length === 0) {
      return res.status(400).json({ error: 'Falta la conversación' });
    }
    if (conversacion.length > MAX_TURNOS) {
      return res.status(400).json({ error: 'Conversación demasiado larga, reinicia el chat' });
    }

    const mensajes = [];
    for (const m of conversacion) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
        return res.status(400).json({ error: 'Formato de mensaje inválido' });
      }
      mensajes.push({ role: m.role, content: m.content.slice(0, MAX_CHARS_MENSAJE) });
    }
    if (mensajes[mensajes.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'El último mensaje debe ser del usuario' });
    }

    const system = await construirPrompt();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const respuesta = await client.messages.create({
      model: MODELO,
      max_tokens: 350,
      system,
      messages: mensajes
    });

    const texto = respuesta.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || `Te paso con un asesor por WhatsApp: ${WHATSAPP}`;

    res.json({ ok: true, respuesta: texto, whatsapp: WHATSAPP_LINK });
  } catch (err) {
    console.error('Error en agente de chat:', err.message);
    res.status(500).json({
      error: 'No pude procesar tu mensaje',
      respuesta: `Tuve un problema técnico. Mejor escríbeme directo por WhatsApp: ${WHATSAPP}`,
      whatsapp: WHATSAPP_LINK
    });
  }
});

export default router;
