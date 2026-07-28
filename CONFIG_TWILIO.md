# Configuración Twilio WhatsApp

## 1. Que es Twilio

Twilio permite enviar mensajes de WhatsApp automáticamente desde tu backend a clientes.

**Caso de uso:** Cuando confirmes un pago, envía un WhatsApp al cliente:
```
✅ Reserva confirmada!
Folio: GOR-0001
Ruta: Ruta del Río
Fecha: 2026-08-15 10:00 AM
Monto pagado: $1,200 MXN

Te esperamos en Chignahuapan. ¡Aventura sin límites!
```

## 2. Credenciales en Vercel

Ve a **vercel.com** → `gladiadores-backend` → **Environment Variables**

Agrega:

| Variable | Valor | Dónde |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxx` | console.twilio.com → Account Info |
| `TWILIO_AUTH_TOKEN` | `auth_token_secreto` | Misma sección |
| `TWILIO_WHATSAPP_FROM` | `+14155238886` | Número de Twilio (te lo asignan) |
| `TWILIO_WHATSAPP_TO_PREFIX` | `+52` | Prefijo México (puede ser +1 para USA, etc) |

## 3. Paso 1: Crear Cuenta Twilio (Gratis hasta $10)

1. Ve a **twilio.com**
2. Sign up → selecciona "WhatsApp"
3. Verifica tu teléfono (te llega código SMS)
4. Te asignan un número de Twilio + SID + Auth Token

## 4. Paso 2: Conectar WhatsApp Business

En **console.twilio.com**:
1. **Messaging** → **Try it out** → **Send an SMS**
2. Busca **WhatsApp** → **Get started**
3. Vincula tu número de WhatsApp Business (el +52 797 100 1929)
4. Twilio te asigna un número de prueba

## 5. Backend - Servicio de Mensajes (TODO)

Crear `services/whatsapp.js`:

```javascript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function enviarConfirmacion(reserva) {
  const mensaje = `
✅ Reserva confirmada!
Folio: ${reserva.folio}
Ruta: ${reserva.ruta}
Fecha: ${new Date(reserva.fecha).toLocaleDateString('es-MX')} ${reserva.horario}
Monto: $${reserva.monto} MXN

Te esperamos en Chignahuapan. ¡Aventura sin límites!
`.trim();

  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${process.env.TWILIO_WHATSAPP_TO_PREFIX}${reserva.cliente.whatsapp}`,
      body: mensaje
    });

    // Guardar que se envió
    reserva.whatsappEnviado = true;
    await reserva.save();

    console.log(`✅ WhatsApp enviado a ${reserva.cliente.whatsapp}`);
  } catch (err) {
    console.error('Error enviando WhatsApp:', err.message);
    // No falles la reserva, solo log
  }
}
```

## 6. Integración en Backend

En `routes/reservas.js`, después de crear una reserva:

```javascript
import { enviarConfirmacion } from '../services/whatsapp.js';

// Después de res.status(201).json({ ok: true, folio, mensaje })
await enviarConfirmacion(reserva);  // Fire and forget
```

## 7. Testing

**Sandbox (Gratis):**
1. Twilio te da un número de prueba
2. Tú agregas tu número personal a la lista blanca
3. Prueba enviando mensajes

**Producción:**
1. Solicita a Twilio "Número de WhatsApp Production"
2. Necesita aprobación de WhatsApp Business
3. Luego puedes enviar a cualquier número

## Pasos siguientes

1. ✅ Crear cuenta Twilio
2. ⏳ Obtener SID, Auth Token, número de WhatsApp
3. ⏳ Agregar credenciales a Vercel
4. ⏳ Crear `services/whatsapp.js`
5. ⏳ Integrar en `routes/reservas.js`
6. ⏳ Probar en sandbox
7. ⏳ Solicitar acceso a producción

## Status en Twilio Console

En tu screenshot veo que estás verificando el teléfono. Eso es el paso correcto:
- Agrega tu número personal (+52 797...)
- Completa la verificación 2FA
- Listo para enviar mensajes de prueba
