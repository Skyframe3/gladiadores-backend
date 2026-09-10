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
    // El cliente eligió adelantar 25, 50 o el 100%: el mensaje tiene que
    // decirle exactamente lo que él eligió, no un 25% fijo.
    const pct = reserva.porcentajePago || (reserva.modoPago === 'completo' ? 100 : 25);
    const aPagar = Math.round(reserva.montoTotal * pct / 100);
    const resto = reserva.montoTotal - aPagar;
    const pago = pct === 100
      ? `*Total a pagar:* $${reserva.montoTotal} MXN (pago completo)`
      : `*A transferir ahora (${pct}%):* $${aPagar} MXN · *Resto el día de la ruta:* $${resto} MXN`;
    const mensaje = `📋 *Solicitud de reserva recibida*

*Folio:* ${reserva.folio}
*Ruta:* ${reserva.ruta}
*Fecha:* ${fecha}
*Horario:* ${reserva.horario}
*Cliente:* ${reserva.cliente?.nombre || ''}
*Correo:* ${reserva.cliente?.email || ''}
*WhatsApp:* ${reserva.cliente?.whatsapp || ''}
*Unidades:* ${(reserva.unidades || []).map(u => `${u.nombre} (${u.personas}p) $${u.precio}`).join(", ")}
*Personas:* ${reserva.personas}
*Total:* $${reserva.montoTotal} MXN
${pago}

Tu lugar queda apartado en cuanto validemos tu transferencia.\n\n¡Te esperamos en Chignahuapan!

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
