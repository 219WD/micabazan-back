const Cart = require('../models/Cart');
const User = require('../models/User');
const { sendCarritoAbandonadoEmail } = require('./emailSender');

// ─── Configuración ────────────────────────────────────────────────────────────
const ABANDONED_AFTER_MS  = 1 * 60 * 60 * 1000;  // 1 hora sin actividad → email
const EXPIRES_AFTER_MS    = 24 * 60 * 60 * 1000; // 24 horas → setea TTL para borrado
const CRON_INTERVAL_MS    = 15 * 60 * 1000;       // corre cada 15 minutos

let cronTimer = null;

// ════════════════════════════════════════════════════════════════════════════════
// JOB PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════════
const runAbandonedCartJob = async () => {
  try {  
    const now = new Date();

    // ── Buscar carritos inicializados con items, sin email enviado,
    //    y sin actividad hace más de ABANDONED_AFTER_MS ──────────────────────
    const abandonedThreshold = new Date(now - ABANDONED_AFTER_MS);
    const expiredThreshold   = new Date(now - EXPIRES_AFTER_MS);

    const candidates = await Cart.find({
      status: 'inicializado',
      'items.0': { $exists: true },         // tiene al menos un item
      expiresAt: null,                       // no tiene TTL seteado aún
      updatedAt: { $lt: abandonedThreshold },
    }).populate('items.productId', 'title image price');

    if (candidates.length === 0) return;

    console.log(`🛒 [AbandonedCart] ${candidates.length} carritos candidatos`);

    for (const cart of candidates) {
      try {
        const user = await User.findById(cart.userId).select('name email');
        if (!user) {
          // Usuario eliminado → borrar carrito directamente
          await cart.deleteOne();
          continue;
        }

        const cartAge = now - cart.updatedAt;

        if (cartAge >= EXPIRES_AFTER_MS) {
          // ── Más de 24hs: setear expiresAt → MongoDB lo borra solo ──────────
          cart.expiresAt = new Date(now.getTime() + 60 * 1000); // 1 minuto más → borrado casi inmediato
          await cart.save();
          console.log(`🗑️  [AbandonedCart] TTL seteado para carrito ${cart._id} (usuario: ${user.email})`);

        } else if (!cart.abandonedEmailSent) {
          // ── Entre 1h y 24hs: mandar email de recordatorio ─────────────────
          const result = await sendCarritoAbandonadoEmail(cart, user);

          if (result.success) {
            cart.abandonedEmailSent = true;
            // Setear expiresAt a 24hs desde ahora para que MongoDB lo limpie
            cart.expiresAt = new Date(now.getTime() + EXPIRES_AFTER_MS);
            await cart.save();
            console.log(`📧 [AbandonedCart] Email enviado a ${user.email} — carrito ${cart._id}`);
          }
        }
      } catch (cartErr) {
        console.error(`❌ [AbandonedCart] Error procesando carrito ${cart._id}:`, cartErr.message);
      }
    }
  } catch (err) {
    console.error('❌ [AbandonedCart] Error en job:', err.message);
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// ARRANCAR Y DETENER EL CRON
// ════════════════════════════════════════════════════════════════════════════════
const startAbandonedCartCron = () => {
  if (cronTimer) return; // ya está corriendo
  console.log(`⏰ [AbandonedCart] Cron iniciado — intervalo: ${CRON_INTERVAL_MS / 60000} min`);
  cronTimer = setInterval(runAbandonedCartJob, CRON_INTERVAL_MS);

  // Correr una vez al arrancar también
  runAbandonedCartJob();
};

const stopAbandonedCartCron = () => {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    console.log('⏹️  [AbandonedCart] Cron detenido');
  }
};

module.exports = { startAbandonedCartCron, stopAbandonedCartCron, runAbandonedCartJob };