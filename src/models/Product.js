const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  // 🔥 NUEVO: Array de imágenes adicionales
  additionalImages: [{
    type: String
  }],
  description: String,
  stock: {
    type: Number,
    required: true,
    min: 0
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  isUsd: {
    type: Boolean,
    default: false,
  },
  category: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true,
  },
    isPartnerOnly: {
    type: Boolean,
    default: false
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  numReviews: {
    type: Number,
    default: 0
  },
  // 🔥 NUEVO: Referencias a los ratings en los carritos
  cartRatings: [{
    cartId: {
      type: Schema.Types.ObjectId,
      ref: 'Cart'
    },
    stars: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    ratedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// 🔹 MÉTODOS PARA MANEJO DE STOCK
ProductSchema.methods = {
  hasEnoughStock: function(quantity) {
    return this.stock >= quantity;
  },
  
  reduceStock: async function(quantity) {
    if (!this.hasEnoughStock(quantity)) {
      throw new Error(`Stock insuficiente. Disponible: ${this.stock}, Solicitado: ${quantity}`);
    }
    this.stock -= quantity;
    return await this.save();
  },
  
  increaseStock: async function(quantity) {
    this.stock += quantity;
    return await this.save();
  },

  // 🔥 NUEVO: Método para agregar rating desde carrito
addCartRating: async function(cartId, stars, comment = '') {
  const parsedStars = Number(stars);
  if (parsedStars < 1 || parsedStars > 5) {
    throw new Error('El rating debe estar entre 1 y 5');
  }

  const existingRatingIndex = this.cartRatings.findIndex(
    rating => rating.cartId.toString() === cartId.toString()
  );

  if (existingRatingIndex !== -1) {
    this.cartRatings[existingRatingIndex] = {
      cartId,
      stars: parsedStars,
      comment,
      ratedAt: new Date()
    };
  } else {
    this.cartRatings.push({
      cartId,
      stars: parsedStars,
      comment,
      ratedAt: new Date()
    });
  }

  this.calculateAverageRating();
  return await this.save();
},

  // 🔥 NUEVO: Calcular rating promedio basado en cartRatings
  calculateAverageRating: function() {
    if (this.cartRatings.length === 0) {
      this.rating = 0;
      this.numReviews = 0;
      return;
    }

    const totalStars = this.cartRatings.reduce((sum, rating) => sum + rating.stars, 0);
    this.rating = Number((totalStars / this.cartRatings.length).toFixed(2));
    this.numReviews = this.cartRatings.length;
  }
};

// 🔹 MIDDLEWARE: Si el stock llega a 0, desactivar automáticamente
ProductSchema.pre('save', function(next) {
  if (this.stock === 0 && this.isActive) {
    this.isActive = false;
  } else if (this.stock > 0 && !this.isActive) {
    this.isActive = true;
  }
  next();
});

module.exports = mongoose.model('Product', ProductSchema);