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
    const mensaje = `✅ *Reserva Confirmada*

*Folio:* GOR-${String(reserva._id).slice(-4).toUpperCase()}
*Ruta:* ${reserva.ruta}
*Fecha:* ${fecha}
*Horario:* ${reserva.horario}
*Asientos:* ${reserva.asientos.join(', ')}
*Monto:* $${reserva.monto} MXN

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
