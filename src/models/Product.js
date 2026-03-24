const mongoose = require('mongoose');
const { Schema } = mongoose;

const TALLES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'];

// ─── Subdocumento: variante (talle + color + stock propio) ────────────────────
// Ejemplos:
//   { talle: 'M',  color: 'Negro', stock: 4 }
//   { talle: 'XL', color: 'Blanco', stock: 2 }
//   { talle: 'Único', color: null, stock: 10 }  ← sin talle ni color
const VarianteSchema = new Schema({
  talle: { type: String, enum: [...TALLES, null], default: null },
  color: { type: String, default: null, trim: true },
  stock: { type: Number, required: true, min: 0, default: 0 },
}, { _id: true });

const ProductSchema = new Schema({
  title: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  additionalImages: [{ type: String }],
  description: String,

  // ── Stock total calculado (suma de variantes, o stock simple si no hay variantes)
  // Se recalcula automáticamente en el pre-save hook.
  stock: { type: Number, required: true, min: 0, default: 0 },

  price:      { type: Number, required: true, min: 0 },
  precioAntes: { type: Number, default: null, min: 0 },
  isUsd:      { type: Boolean, default: false },

  category:      { type: String },
  isActive:      { type: Boolean, default: true },
  isFeatured:    { type: Boolean, default: false },
  isPartnerOnly: { type: Boolean, default: false },

  // ── Variantes: cada combinación talle/color con su propio stock ──────────────
  // Si el array está vacío, el producto no maneja variantes y usa `stock` directamente.
  variantes: [VarianteSchema],

  // ── Campos legacy — se mantienen para retrocompatibilidad pero ya no se usan
  // directamente en la lógica de stock. Se pueden usar como "lista de talles disponibles"
  // derivada de las variantes si se quiere mostrar algo rápido.
  talles: [{ type: String, enum: TALLES }],
  colores: [{ type: String }], // lista de colores únicos (derivada)

  rating:     { type: Number, default: 0, min: 0, max: 5 },
  numReviews: { type: Number, default: 0 },

  cartRatings: [{
    cartId:  { type: Schema.Types.ObjectId, ref: 'Cart' },
    stars:   { type: Number, min: 1, max: 5 },
    comment: String,
    ratedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// ─── VIRTUAL: ¿usa variantes? ─────────────────────────────────────────────────
ProductSchema.virtual('usaVariantes').get(function () {
  return this.variantes && this.variantes.length > 0;
});

// ─── MÉTODOS ──────────────────────────────────────────────────────────────────
ProductSchema.methods = {

  // Recalcula stock total sumando variantes. Si no hay variantes, no toca stock.
  recalcularStock() {
    if (this.variantes && this.variantes.length > 0) {
      this.stock = this.variantes.reduce((sum, v) => sum + v.stock, 0);
    }
    // Derivar talles y colores únicos
    this.talles  = [...new Set(this.variantes.filter(v => v.talle).map(v => v.talle))];
    this.colores = [...new Set(this.variantes.filter(v => v.color).map(v => v.color))];
  },

  // ── Stock general (sin variante específica) ───────────────────────────────
  hasEnoughStock(quantity) {
    return this.stock >= quantity;
  },

  async reduceStock(quantity) {
    if (!this.hasEnoughStock(quantity)) {
      throw new Error(`Stock insuficiente. Disponible: ${this.stock}, Solicitado: ${quantity}`);
    }
    this.stock -= quantity;
    return await this.save();
  },

  async increaseStock(quantity) {
    this.stock += quantity;
    return await this.save();
  },

  // ── Stock por variante específica ─────────────────────────────────────────
  getVariante(talle, color) {
    return this.variantes.find(v =>
      (talle ? v.talle === talle : !v.talle) &&
      (color  ? v.color === color  : !v.color)
    );
  },

  stockVariante(talle, color) {
    const v = this.getVariante(talle, color);
    return v ? v.stock : 0;
  },

  hasEnoughStockVariante(talle, color, quantity) {
    return this.stockVariante(talle, color) >= quantity;
  },

  async reduceStockVariante(talle, color, quantity) {
    const v = this.getVariante(talle, color);
    if (!v) throw new Error(`Variante no encontrada: talle=${talle}, color=${color}`);
    if (v.stock < quantity) {
      throw new Error(`Stock insuficiente para ${talle ?? ''}${color ? ' / ' + color : ''}. Disponible: ${v.stock}, Solicitado: ${quantity}`);
    }
    v.stock -= quantity;
    this.recalcularStock();
    return await this.save();
  },

  async increaseStockVariante(talle, color, quantity) {
    let v = this.getVariante(talle, color);
    if (!v) {
      // Crear variante si no existía
      this.variantes.push({ talle: talle || null, color: color || null, stock: quantity });
    } else {
      v.stock += quantity;
    }
    this.recalcularStock();
    return await this.save();
  },

  // ── Ratings ───────────────────────────────────────────────────────────────
  async addCartRating(cartId, stars, comment = '') {
    const parsedStars = Number(stars);
    if (parsedStars < 1 || parsedStars > 5) throw new Error('El rating debe estar entre 1 y 5');

    const idx = this.cartRatings.findIndex(r => r.cartId.toString() === cartId.toString());
    if (idx !== -1) {
      this.cartRatings[idx] = { cartId, stars: parsedStars, comment, ratedAt: new Date() };
    } else {
      this.cartRatings.push({ cartId, stars: parsedStars, comment, ratedAt: new Date() });
    }
    this.calculateAverageRating();
    return await this.save();
  },

  calculateAverageRating() {
    if (this.cartRatings.length === 0) { this.rating = 0; this.numReviews = 0; return; }
    const total = this.cartRatings.reduce((sum, r) => sum + r.stars, 0);
    this.rating     = Number((total / this.cartRatings.length).toFixed(2));
    this.numReviews = this.cartRatings.length;
  },
};

// ─── PRE-SAVE: recalcular stock total + activar/desactivar ────────────────────
ProductSchema.pre('save', function (next) {
  if (this.variantes && this.variantes.length > 0) {
    this.recalcularStock();
  }
  if (this.stock === 0 && this.isActive)  this.isActive = false;
  if (this.stock > 0  && !this.isActive) this.isActive = true;
  next();
});

module.exports = mongoose.model('Product', ProductSchema);