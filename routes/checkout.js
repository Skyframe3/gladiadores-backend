import express from 'express';
import { MercadoPagoConfig, Preference } from 'mercadopago';

const router = express.Router();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// POST /api/checkout — Crea una preference en Mercado Pago
router.post('/', async (req, res) => {
  try {
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
        notification_url: `${process.env.FRONTEND_URL || 'https://gladiadoresoffroad.com'}/api/webhooks/mercadopago`,
        external_reference: externalReference,
        back_urls: {
          success: 'https://gladiadoresoffroad.com/?success=true',
          failure: 'https://gladiadoresoffroad.com/?error=payment_failed',
          pending: 'https://gladiadoresoffroad.com/?pending=true'
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
