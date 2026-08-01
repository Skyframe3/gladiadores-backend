import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const router = express.Router();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// El webhook lo llama Mercado Pago contra el backend, no contra el sitio.
const BACKEND_URL = process.env.BACKEND_URL || 'https://gladiadores-backend.vercel.app';
const SITIO_URL = process.env.FRONTEND_URL || 'https://www.gladiadoresoffroad.com';

// POST /api/checkout — Crea una preference en Mercado Pago
router.post('/', async (req, res) => {
  try {
    if (!process.env.MP_ACCESS_TOKEN) {
      console.error('MP_ACCESS_TOKEN no configurado');
      return res.status(503).json({ error: 'Pagos no disponibles temporalmente' });
    }

    const { items, payer, externalReference } = req.body;

    if (!items || items.length === 0 || !payer || !externalReference) {
      return res.status(400).json({ error: 'Items, payer y externalReference requeridos' });
    }

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: items.map(i => ({
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unit_price
        })),
        payer: {
          name: payer.name,
          email: payer.email,
          phone: { number: payer.phone }
        },
        notification_url: `${BACKEND_URL}/api/webhooks/mercadopago`,
        external_reference: externalReference,
        back_urls: {
          success: `${SITIO_URL}/?pago=exito&folio=${encodeURIComponent(externalReference)}`,
          failure: `${SITIO_URL}/?pago=fallido`,
          pending: `${SITIO_URL}/?pago=pendiente&folio=${encodeURIComponent(externalReference)}`
        },
        auto_return: 'approved'
      }
    });

    res.json({
      ok: true,
      preferenceId: result.id,
      initPoint: result.init_point
    });
  } catch (err) {
    console.error('Error creating preference:', err);
    res.status(500).json({ error: 'Error creando checkout' });
  }
});

export default router;
