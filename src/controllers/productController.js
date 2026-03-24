const Product = require('../models/Product');

const TALLES_VALIDOS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Valida y normaliza el array de variantes que llega del body.
// Cada variante: { talle?, color?, stock }
const parseVariantes = (variantes = []) => {
  return variantes.map((v) => {
    const talle = v.talle ? String(v.talle).trim() : null;
    const color = v.color ? String(v.color).trim() : null;
    const stock = Number(v.stock);

    if (talle && !TALLES_VALIDOS.includes(talle)) {
      throw new Error(`Talle inválido: "${talle}". Válidos: ${TALLES_VALIDOS.join(', ')}`);
    }
    if (isNaN(stock) || stock < 0) {
      throw new Error(`Stock inválido en variante talle=${talle} color=${color}`);
    }
    return { talle, color, stock };
  });
};

// ─── GET todos los productos ──────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const { category, active, search, isFeatured } = req.query;
    const filter = {};
    if (category)            filter.category  = category;
    if (active !== undefined) filter.isActive  = active === 'true';
    if (search)              filter.title     = { $regex: search, $options: 'i' };
    if (isFeatured)          filter.isFeatured = isFeatured === 'true';

    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    console.error('getProducts:', err);
    res.status(500).json({ error: 'Error al obtener los productos' });
  }
};

// ─── GET producto por ID ──────────────────────────────────────────────────────
const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
};

// ─── POST crear producto ──────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const {
      title, image, additionalImages, description,
      stock, price, precioAntes,
      isUsd, category, isPartnerOnly,
      variantes,
    } = req.body;

    if (!title || !image || price === undefined) {
      return res.status(400).json({ error: 'title, image y price son obligatorios' });
    }
    if (price < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });
    if (precioAntes != null && precioAntes < price) {
      return res.status(400).json({ error: 'precioAntes debe ser mayor al precio actual' });
    }

    let variantesParsed = [];
    let stockFinal = 0;

    if (variantes && variantes.length > 0) {
      // Modo variantes: stock se calcula sumando las variantes
      variantesParsed = parseVariantes(variantes);
      stockFinal = variantesParsed.reduce((sum, v) => sum + v.stock, 0);
    } else {
      // Modo simple: stock provisto directamente
      if (stock === undefined) return res.status(400).json({ error: 'stock es obligatorio si no hay variantes' });
      stockFinal = Number(stock);
      if (stockFinal < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
    }

    const product = await Product.create({
      title: title.trim(),
      image,
      additionalImages: additionalImages || [],
      description: description?.trim() || '',
      stock: stockFinal,
      price: Number(price),
      precioAntes: precioAntes != null ? Number(precioAntes) : null,
      isUsd: isUsd || false,
      category: category?.trim() || null,
      isPartnerOnly: isPartnerOnly || false,
      variantes: variantesParsed,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('createProduct:', err);
    res.status(400).json({ error: err.message || 'Error al crear el producto' });
  }
};

// ─── PUT actualizar producto ──────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const {
      title, image, additionalImages, description,
      stock, price, precioAntes,
      isUsd, category, isPartnerOnly,
      variantes,
    } = req.body;

    if (price !== undefined && price < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    if (title       !== undefined) product.title       = title.trim();
    if (image       !== undefined) product.image       = image;
    if (additionalImages !== undefined) product.additionalImages = additionalImages;
    if (description !== undefined) product.description = description.trim();
    if (price       !== undefined) product.price       = Number(price);
    if (precioAntes !== undefined) product.precioAntes = precioAntes != null ? Number(precioAntes) : null;
    if (isUsd       !== undefined) product.isUsd       = isUsd;
    if (category    !== undefined) product.category    = category?.trim() || null;
    if (isPartnerOnly !== undefined) product.isPartnerOnly = isPartnerOnly;

    if (variantes !== undefined) {
      if (variantes.length > 0) {
        // Reemplazar variantes — el pre-save hook recalcula stock total
        product.variantes = parseVariantes(variantes);
      } else {
        // Se borraron todas las variantes → pasar a modo simple
        product.variantes = [];
        if (stock !== undefined) {
          if (Number(stock) < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
          product.stock = Number(stock);
        }
      }
    } else if (stock !== undefined && product.variantes.length === 0) {
      // Modo simple: actualizar stock directamente solo si no hay variantes
      if (Number(stock) < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });
      product.stock = Number(stock);
    }

    await product.save();
    res.json(product);
  } catch (err) {
    console.error('updateProduct:', err);
    res.status(400).json({ error: err.message || 'Error al actualizar el producto' });
  }
};

// ─── DELETE producto ──────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

// ─── PATCH toggle isActive ────────────────────────────────────────────────────
const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!product.isActive && product.stock === 0) {
      return res.status(400).json({ error: 'No se puede activar un producto sin stock' });
    }
    product.isActive = !product.isActive;
    await product.save();
    res.json({ message: `Producto ${product.isActive ? 'activado' : 'desactivado'}`, product });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado del producto' });
  }
};

// ─── PATCH toggle isUsd ───────────────────────────────────────────────────────
const toggleProductIsUsd = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    product.isUsd = !product.isUsd;
    await product.save();
    res.json({ message: `Precio en ${product.isUsd ? 'USD' : 'ARS'}`, product });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar moneda' });
  }
};

// ─── PATCH toggle isPartnerOnly ───────────────────────────────────────────────
const togglePartnerOnly = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    product.isPartnerOnly = !product.isPartnerOnly;
    await product.save();
    res.json({ message: `Producto ${product.isPartnerOnly ? 'exclusivo' : 'público'}`, product });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar exclusividad' });
  }
};

// ─── PATCH toggle isFeatured ──────────────────────────────────────────────────
const toggleFeatured = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    product.isFeatured = !product.isFeatured;
    await product.save();
    res.json({ message: `Producto ${product.isFeatured ? 'destacado' : 'no destacado'}`, product });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar destacado' });
  }
};

// ─── POST restaurar stock ─────────────────────────────────────────────────────
// Si se manda talle y/o color, restaura la variante específica.
// Si no, restaura el stock general (solo para productos sin variantes).
const restoreStock = async (req, res) => {
  try {
    const { quantity, talle, color } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    if (talle || color) {
      await product.increaseStockVariante(talle || null, color || null, Number(quantity));
    } else {
      await product.increaseStock(Number(quantity));
    }

    res.json({ message: `Stock restaurado. Stock total: ${product.stock}`, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── POST verificar stock ─────────────────────────────────────────────────────
// Si se manda talle y/o color, verifica la variante específica.
const checkStock = async (req, res) => {
  try {
    const { quantity, talle, color } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    let available, hasStock;
    if ((talle || color) && product.variantes.length > 0) {
      available = product.stockVariante(talle || null, color || null);
      hasStock  = available >= Number(quantity);
    } else {
      available = product.stock;
      hasStock  = product.hasEnoughStock(Number(quantity));
    }

    res.json({ hasStock, available, requested: Number(quantity) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── PATCH reducir stock variante (lo llama el carrito al confirmar compra) ───
const reduceStockVariante = async (req, res) => {
  try {
    const { quantity, talle, color } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    if (product.variantes.length > 0 && (talle || color)) {
      await product.reduceStockVariante(talle || null, color || null, Number(quantity));
    } else {
      await product.reduceStock(Number(quantity));
    }

    res.json({ message: 'Stock reducido', product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── GET debug ────────────────────────────────────────────────────────────────
const debugProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({
      _id: product._id, title: product.title,
      stock: product.stock, price: product.price, precioAntes: product.precioAntes,
      variantes: product.variantes,
      talles: product.talles, colores: product.colores,
      isActive: product.isActive, isUsd: product.isUsd, isFeatured: product.isFeatured,
      rating: product.rating, numReviews: product.numReviews,
      updatedAt: product.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener debug' });
  }
};

module.exports = {
  getProducts, getProductById, createProduct, updateProduct, deleteProduct,
  toggleProductStatus, toggleProductIsUsd, togglePartnerOnly, toggleFeatured,
  restoreStock, checkStock, reduceStockVariante, debugProduct,
};