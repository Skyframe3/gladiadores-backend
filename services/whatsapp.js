import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function enviarConfirmacionReserva(reserva) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠️ Twilio no configurado — saltando WhatsApp');
    return false;
  }

  try {
    const fecha = new Date(reserva.fecha).toLocaleDateString('es-MX');
    const pago = reserva.modoPago === 'completo'
      ? `*Pagado:* $${reserva.monto} MXN (completo)`
      : `*Anticipo:* $${reserva.monto} MXN · *Resto en la ruta:* $${reserva.montoTotal - reserva.monto} MXN`;
    const mensaje = `✅ *Reserva Confirmada*

*Folio:* ${reserva.folio}
*Ruta:* ${reserva.ruta}
*Fecha:* ${fecha}
*Horario:* ${reserva.horario}
*Unidad:* ${reserva.unidad}
*Personas:* ${reserva.personas}
${pago}

¡Te esperamos en Chignahuapan! 🏜️

Para más info: +52 797 100 1929`;

    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:+52${reserva.cliente.whatsapp}`,
      body: mensaje
    });

    console.log(`✅ WhatsApp enviado a +52${reserva.cliente.whatsapp}`);
    return true;
  } catch (err) {
    console.error('❌ Error Twilio:', err.message);
    // No falles la reserva, solo log
    return false;
  }
}
