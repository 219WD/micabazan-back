const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Subschema: dirección de envío ───────────────────────────────────────────
// Se carga en el checkout (independiente de savedAddress del perfil)
const ShippingAddressSchema = new Schema({
  name:       { type: String, required: true },  // receptor
  address:    { type: String, required: true },  // calle y número
  apartment:  { type: String, default: null },   // piso/dpto (opcional)
  city:       { type: String, required: true },
  province:   { type: String, required: true },
  postalCode: { type: String, required: true },
  phone:      { type: String, required: true },
  extraNotes: { type: String, default: null },   // referencias / indicaciones
}, { _id: false });

// ─── Subschema: item del carrito ─────────────────────────────────────────────
const CartItemSchema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  // Snapshot del precio al momento de agregar al carrito
  // Evita que un cambio de precio afecte pedidos ya hechos
  priceAtPurchase: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

// ─── Subschema: rating de producto en el pedido ──────────────────────────────
const RatingSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  stars:     { type: Number, min: 1, max: 5, required: true },
  comment:   { type: String, default: null },
  ratedAt:   { type: Date, default: Date.now },
}, { _id: false });

// ─── Cart Schema principal ───────────────────────────────────────────────────
const CartSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  items: [CartItemSchema],

  // ── Totales ────────────────────────────────────────────────────────────────
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },

  // ── Método de entrega ──────────────────────────────────────────────────────
  deliveryMethod: {
    type: String,
    enum: ['retiro', 'envio'],
    default: 'retiro',
  },

  // Solo requerida si deliveryMethod === 'envio'
  // La validación la hacemos en el controller al momento del checkout
  shippingAddress: {
    type: ShippingAddressSchema,
    default: null,
  },

  // ── Método de pago ─────────────────────────────────────────────────────────
  paymentMethod: {
    type: String,
    enum: ['transferencia', 'mercadopago'],
    default: null, // null hasta que se hace checkout
  },

  // ── Transferencia ──────────────────────────────────────────────────────────
  receiptUrl: {
    type: String,
    default: null, // URL del comprobante subido por el usuario
  },

  // ── MercadoPago ────────────────────────────────────────────────────────────
  mercadopagoPreferenceId: {
    type: String,
    default: null,
  },
  mercadopagoPaymentId: {
    type: String,
    default: null,
  },

  // ── Estado del pedido ──────────────────────────────────────────────────────
  /*
    Flujo transferencia:
      inicializado → pendiente (checkout) → pagado (admin confirma) → preparacion → 
      [en_camino si es envio] → entregado
    
    Flujo MercadoPago:
      inicializado → pagado (MP confirma automático) → preparacion →
      [en_camino si es envio] → entregado

    Cancelado: desde cualquier estado antes de entregado
  */
  status: {
    type: String,
    enum: [
      'inicializado', // carrito activo, aún no fue al checkout
      'pendiente',    // checkout hecho por transferencia, esperando comprobante/confirmación
      'pagado',       // pago confirmado (admin o MP)
      'preparacion',  // armando el pedido
      'en_camino',    // solo para envios, despachado
      'entregado',    // entregado/retirado
      'cancelado',
    ],
    default: 'inicializado',
    index: true,
  },

  // ── Carrito abandonado ─────────────────────────────────────────────────────
  // Un carrito se considera "abandonado" si está en 'inicializado'
  // y no tuvo actividad en X tiempo (lo define el cron)
  abandonedEmailSent: {
    type: Boolean,
    default: false,
  },
  // TTL: MongoDB elimina el documento cuando llega a esta fecha
  // Solo se setea en carritos abandonados. Se cancela si el usuario retoma.
  expiresAt: {
    type: Date,
    default: null,
    index: { expireAfterSeconds: 0 }, // TTL index — MongoDB hace el delete solo
  },

  // ── Ratings (post-entrega) ─────────────────────────────────────────────────
  ratings: [RatingSchema],

}, { timestamps: true }); // createdAt y updatedAt automáticos

// ─── Índices útiles para queries frecuentes ───────────────────────────────────
CartSchema.index({ userId: 1, status: 1 });
CartSchema.index({ status: 1, updatedAt: 1 }); // para el cron de abandonados
CartSchema.index({ mercadopagoPaymentId: 1 }, { sparse: true });

// ─── Método: recalcular total desde los items ─────────────────────────────────
// Usa priceAtPurchase para no depender de consultas externas
CartSchema.methods.recalculateTotal = function () {
  this.totalAmount = this.items.reduce(
    (sum, item) => sum + item.priceAtPurchase * item.quantity,
    0
  );
};

// ─── Método: ¿el carrito está activo (modificable)? ──────────────────────────
CartSchema.methods.isEditable = function () {
  return this.status === 'inicializado';
};

// ─── Método: ¿el carrito está listo para hacer checkout? ─────────────────────
CartSchema.methods.canCheckout = function () {
  return this.status === 'inicializado' && this.items.length > 0;
};

// ─── Middleware pre-save: limpiar expiresAt si el carrito ya no está abandonado
CartSchema.pre('save', function (next) {
  // Si el carrito avanzó de estado, cancelar el TTL
  if (this.status !== 'inicializado' && this.expiresAt !== null) {
    this.expiresAt = null;
  }
  next();
});

module.exports = mongoose.model('Cart', CartSchema);