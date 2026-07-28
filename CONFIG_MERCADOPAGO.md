# Configuración Mercado Pago

## 1. Credenciales en Vercel

Ve a **vercel.com** → proyecto `gladiadores-backend` → **Settings** → **Environment Variables**

Agrega estas 3 variables:

| Variable | Valor | Dónde obtenerla |
|---|---|---|
| `MP_ACCESS_TOKEN` | `APP_USR_...` | dashboard.mercadopago.com.mx → Configuración → Credenciales de producción |
| `MP_PUBLIC_KEY` | `APP_USR_...` | Misma sección (Public key) |
| `MP_WEBHOOK_TOKEN` | `tu_token_secreto_aleatorio` | Genéralo tú (ej: `sha256(random)`) para validar webhooks |

**Importante**: En "Credenciales de producción" copia:
- Access Token (largo, starts with `APP_USR_`)
- Public Key

## 2. Endpoint de Pago (Frontend)

Cuando el cliente hace clic en "PAGAR", necesitas:

```javascript
// En index.html, en el paso 4 del checkout:

const preference = {
  items: [
    {
      title: bRoute.name,
      quantity: bSeats.length,
      unit_price: bUnit.price
    },
    // ... agregar extras si hay
  ],
  payer: {
    name: bNombre,
    email: bEmail,
    phone: { number: bWhatsapp }
  },
  notification_url: 'https://api.gladiadoresoffroad.com/api/webhooks/mercadopago',
  external_reference: bRoute._id  // ID de la reserva
};

// POST a tu backend para crear la preference
const resp = await fetch('https://api.gladiadoresoffroad.com/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(preference)
});
const { preferenceId } = await resp.json();

// Redirigir a Mercado Pago
window.location.href = `https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=${preferenceId}`;
```

## 3. Backend - Endpoint de Checkout (TODO)

Crear en `routes/checkout.js`:

```javascript
POST /api/checkout
{
  items: [...],
  payer: {...},
  notification_url: "...",
  external_reference: "reserva_id"
}

Respuesta:
{
  preferenceId: "...",
  initPoint: "https://www.mercadopago.com.mx/..."
}
```

## 4. Webhook - Ya configurado

Backend recibe en `POST /api/webhooks/mercadopago`:
- Mercado Pago envía: `{ type: 'payment', data: { id: payment_id } }`
- Backend actualiza `Reserva.estadoPago = 'pagado'`
- Si se reembolsa: `Reserva.estadoPago = 'reembolsado'`

## 5. Testing en Sandbox

Para probar sin dinero real:
1. Usa credenciales de **sandbox** (no producción)
2. Mercado Pago te da tarjetas de prueba
3. Una vez funcione, cambia a **producción**

## Pasos siguientes

1. ✅ Agregar `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_TOKEN` en Vercel
2. ⏳ Crear endpoint `POST /api/checkout` en backend
3. ⏳ Actualizar frontend: reemplazar simulación de pago por Mercado Pago real
4. ⏳ Crear endpoint `POST /api/webhook-mercadopago` para confirmar pagos (ya existe el skeleton)
5. ⏳ Probar en sandbox
6. ⏳ Cambiar a producción
