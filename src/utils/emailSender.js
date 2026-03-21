const transporter = require('../config/nodemailer');

// ─── Helper: nombre del negocio desde env o fallback ─────────────────────────
const SHOP_NAME = process.env.SHOP_NAME || 'Ecommerce';
const FRONTEND  = process.env.FRONTEND_URL || 'http://localhost:5173';
const FROM      = `"${SHOP_NAME}" <${process.env.EMAIL_USER}>`;

// ─── Helper: wrapper de envío con log ────────────────────────────────────────
const send = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email enviado a ${mailOptions.to} — ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Error enviando email a ${mailOptions.to}:`, err.message);
    return { success: false, error: err.message };
  }
};

// ─── Helper: estilos base ─────────────────────────────────────────────────────
const baseStyle = `font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;`;
const btnStyle  = (color = '#4CAF50') => `background-color: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;`;
const footer    = `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;"><p>¡Gracias por elegirnos!<br><strong>El equipo de ${SHOP_NAME}</strong></p></div>`;

// ─── Helper: resumen del pedido ───────────────────────────────────────────────
const orderSummaryHTML = (cart) => `
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
    <tr>
      <td style="padding: 8px 0; color: #666; width: 150px;"><strong>N° de Pedido:</strong></td>
      <td style="padding: 8px 0; font-size: 12px;">${cart._id}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;"><strong>Total:</strong></td>
      <td style="padding: 8px 0; font-weight: bold;">$${cart.totalAmount?.toLocaleString('es-AR')}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;"><strong>Pago:</strong></td>
      <td style="padding: 8px 0; text-transform: capitalize;">${cart.paymentMethod}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;"><strong>Entrega:</strong></td>
      <td style="padding: 8px 0; text-transform: capitalize;">${cart.deliveryMethod}</td>
    </tr>
  </table>
  ${cart.deliveryMethod === 'envio' && cart.shippingAddress ? `
    <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin-top: 10px;">
      <strong>🚚 Dirección de envío</strong><br>
      ${cart.shippingAddress.name}<br>
      ${cart.shippingAddress.address}${cart.shippingAddress.apartment ? `, ${cart.shippingAddress.apartment}` : ''}<br>
      ${cart.shippingAddress.city}, ${cart.shippingAddress.province} (${cart.shippingAddress.postalCode})<br>
      Tel: ${cart.shippingAddress.phone}
      ${cart.shippingAddress.extraNotes ? `<br><em>${cart.shippingAddress.extraNotes}</em>` : ''}
    </div>
  ` : `
    <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin-top: 10px;">
      <strong>🏪 Retiro en local</strong><br>
      Te avisamos cuando esté listo para retirar.
    </div>
  `}
`;

// ════════════════════════════════════════════════════════════════════════════════
// 1. PEDIDO CONFIRMADO (checkout exitoso)
// ════════════════════════════════════════════════════════════════════════════════
const sendPedidoConfirmadoEmail = async (cart, user) => {
  const isPendingTransfer = cart.paymentMethod === 'transferencia';

  return send({
    from: FROM,
    to: user.email,
    subject: `✅ Pedido recibido #${cart._id} — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">¡Pedido recibido, ${user.name}!</h2>
        <p style="color: #666;">
          ${isPendingTransfer
            ? 'Recibimos tu pedido. Una vez que confirmes el pago por transferencia, comenzaremos a prepararlo.'
            : 'Tu pago fue procesado. ¡Ya estamos preparando tu pedido!'
          }
        </p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📦 Resumen</h3>
          ${orderSummaryHTML(cart)}
        </div>
        ${isPendingTransfer ? `
          <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <strong>⚠️ Próximo paso</strong><br>
            Realizá la transferencia y subí el comprobante desde tu perfil para agilizar la confirmación.
          </div>
        ` : ''}
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/mis-pedidos" style="${btnStyle()}">Ver mis pedidos</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 2. PAGO CONFIRMADO (admin confirma transferencia)
// ════════════════════════════════════════════════════════════════════════════════
const sendPagoConfirmadoEmail = async (cart, user) => {
  return send({
    from: FROM,
    to: user.email,
    subject: `💳 Pago confirmado #${cart._id} — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">¡Pago confirmado, ${user.name}!</h2>
        <p style="color: #666;">Verificamos tu transferencia. Tu pedido pasa a preparación.</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
          ${orderSummaryHTML(cart)}
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/mis-pedidos" style="${btnStyle()}">Seguir mi pedido</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 3. EN PREPARACIÓN
// ════════════════════════════════════════════════════════════════════════════════
const sendEnPreparacionEmail = async (cart, user) => {
  return send({
    from: FROM,
    to: user.email,
    subject: `👨‍🍳 Tu pedido está en preparación #${cart._id} — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">¡Estamos preparando tu pedido, ${user.name}!</h2>
        <p style="color: #666;">
          ${cart.deliveryMethod === 'envio'
            ? 'Pronto lo despacharemos. Te notificamos cuando salga.'
            : 'Te avisamos cuando esté listo para que pases a retirarlo.'
          }
        </p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
          ${orderSummaryHTML(cart)}
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/mis-pedidos" style="${btnStyle('#ff9800')}">Seguir mi pedido</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 4. EN CAMINO (solo envíos)
// ════════════════════════════════════════════════════════════════════════════════
const sendEnCaminoEmail = async (cart, user) => {
  return send({
    from: FROM,
    to: user.email,
    subject: `🚚 Tu pedido está en camino #${cart._id} — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">¡Tu pedido está en camino, ${user.name}!</h2>
        <p style="color: #666;">Tu paquete fue despachado y está en camino a tu domicilio.</p>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 6px; margin: 20px 0;">
          ${orderSummaryHTML(cart)}
        </div>
        ${cart.shippingAddress ? `
          <div style="background: #e8f4fd; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <strong>📍 Dirección de entrega</strong><br>
            ${cart.shippingAddress.address}${cart.shippingAddress.apartment ? `, ${cart.shippingAddress.apartment}` : ''}<br>
            ${cart.shippingAddress.city}, ${cart.shippingAddress.province}
          </div>
        ` : ''}
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/mis-pedidos" style="${btnStyle('#2196F3')}">Ver mi pedido</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 5. ENTREGADO
// ════════════════════════════════════════════════════════════════════════════════
const sendPedidoEntregadoEmail = async (cart, user) => {
  return send({
    from: FROM,
    to: user.email,
    subject: `🎉 Pedido entregado #${cart._id} — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">¡Pedido entregado, ${user.name}!</h2>
        <p style="color: #666;">
          Tu pedido fue ${cart.deliveryMethod === 'envio' ? 'entregado' : 'retirado'} exitosamente.
        </p>
        <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>⭐ ¿Qué te pareció?</strong><br>
          Tu opinión ayuda a otros compradores. ¡Calificá tus productos!
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/mis-pedidos" style="${btnStyle()}">Calificar productos</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 6. CARRITO ABANDONADO
// ════════════════════════════════════════════════════════════════════════════════
const sendCarritoAbandonadoEmail = async (cart, user) => {
  const itemsHTML = cart.items
    .filter((i) => i.productId)
    .map(
      (i) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            <img src="${i.productId.image}" alt="${i.productId.title}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;" />
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.productId.title}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align:center;">${i.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align:right;">$${(i.priceAtPurchase * i.quantity).toLocaleString('es-AR')}</td>
        </tr>
      `
    )
    .join('');

  return send({
    from: FROM,
    to: user.email,
    subject: `🛒 ¿Olvidaste algo? Tu carrito te espera — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">Hola ${user.name}, ¡dejaste productos en tu carrito!</h2>
        <p style="color: #666;">Todavía están disponibles, pero el stock es limitado.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; text-align: left;"></th>
              <th style="padding: 8px; text-align: left;">Producto</th>
              <th style="padding: 8px; text-align: center;">Cant.</th>
              <th style="padding: 8px; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <p style="text-align: right; font-weight: bold; font-size: 18px;">
          Total: $${cart.totalAmount?.toLocaleString('es-AR')}
        </p>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}/carrito" style="${btnStyle()}">Completar mi compra</a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
          Tu carrito se eliminará en 24 horas si no completás la compra.
        </p>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// 7. RESET DE CONTRASEÑA
// ════════════════════════════════════════════════════════════════════════════════
const sendPasswordResetRequestEmail = async (user, token) => {
  const link = `${FRONTEND}/reset-password/${token}`;
  return send({
    from: FROM,
    to: user.email,
    subject: `🔐 Restablecer contraseña — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">Restablecer contraseña</h2>
        <p style="color: #666;">Hola <strong>${user.name}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>
        <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>⚠️</strong> Este enlace expira en <strong>1 hora</strong> y es de uso único.
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${link}" style="${btnStyle('#2196F3')}">🔓 Restablecer contraseña</a>
        </div>
        <p style="color: #999; font-size: 12px; text-align: center; margin-top: 15px;">
          Si no solicitaste esto, ignorá este email.
        </p>
        ${footer}
      </div>
    `,
  });
};

const sendPasswordResetConfirmationEmail = async (user) => {
  return send({
    from: FROM,
    to: user.email,
    subject: `✅ Contraseña actualizada — ${SHOP_NAME}`,
    html: `
      <div style="${baseStyle}">
        <h2 style="color: #333;">Contraseña actualizada</h2>
        <p style="color: #666;">Hola <strong>${user.name}</strong>, tu contraseña fue actualizada correctamente.</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>⚠️ ¿No fuiste vos?</strong> Contactanos de inmediato.
        </div>
        <div style="text-align: center; margin-top: 25px;">
          <a href="${FRONTEND}" style="${btnStyle()}">Ir al inicio</a>
        </div>
        ${footer}
      </div>
    `,
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════════════════════════════════
module.exports = {
  sendPedidoConfirmadoEmail,
  sendPagoConfirmadoEmail,
  sendEnPreparacionEmail,
  sendEnCaminoEmail,
  sendPedidoEntregadoEmail,
  sendCarritoAbandonadoEmail,
  sendPasswordResetRequestEmail,
  sendPasswordResetConfirmationEmail,
};