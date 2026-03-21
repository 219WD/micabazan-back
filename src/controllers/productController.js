const Product = require('../models/Product');

// ─── GET todos los productos ──────────────────────────────────────────────────
const getProducts = async (req, res) => {
  try {
    const { category, active, search } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (active !== undefined) filter.isActive = active === 'true';
    if (search) filter.title = { $regex: search, $options: 'i' };

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
    console.error('getProductById:', err);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
};

// ─── POST crear producto ──────────────────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const {
      title,
      image,
      additionalImages,
      description,
      stock,
      price,
      isUsd,
      category,
      isPartnerOnly,
    } = req.body;

    if (!title || !image || stock === undefined || price === undefined) {
      return res.status(400).json({ error: 'title, image, stock y price son obligatorios' });
    }

    if (price < 0) return res.status(400).json({ error: 'El precio no puede ser negativo' });
    if (stock < 0) return res.status(400).json({ error: 'El stock no puede ser negativo' });

    const product = await Product.create({
      title: title.trim(),
      image,
      additionalImages: additionalImages || [],
      description: description?.trim() || '',
      stock: Number(stock),
      price: Number(price),
      isUsd: isUsd || false,
      category: category?.trim() || null,
      isPartnerOnly: isPartnerOnly || false,
    });

    res.status(201).json(product);
  } catch (err) {
    console.error('createProduct:', err);
    res.status(500).json({ error: 'Error al crear el producto', details: err.message });
  }
};

// ─── PUT actualizar producto ──────────────────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const {
      title,
      image,
      additionalImages,
      description,
      stock,
      price,
      isUsd,
      category,
      isPartnerOnly,
    } = req.body;

    if (price !== undefined && price < 0) {
      return res.status(400).json({ error: 'El precio no puede ser negativo' });
    }
    if (stock !== undefined && stock < 0) {
      return res.status(400).json({ error: 'El stock no puede ser negativo' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    // Solo pisa los campos que llegaron
    if (title !== undefined)            product.title            = title.trim();
    if (image !== undefined)            product.image            = image;
    if (additionalImages !== undefined) product.additionalImages = additionalImages;
    if (description !== undefined)      product.description      = description.trim();
    if (stock !== undefined)            product.stock            = Number(stock);
    if (price !== undefined)            product.price            = Number(price);
    if (isUsd !== undefined)            product.isUsd            = isUsd;
    if (category !== undefined)         product.category         = category?.trim() || null;
    if (isPartnerOnly !== undefined)    product.isPartnerOnly    = isPartnerOnly;

    await product.save(); // dispara el pre-save que maneja isActive según stock

    res.json(product);
  } catch (err) {
    console.error('updateProduct:', err);
    res.status(500).json({ error: 'Error al actualizar el producto', details: err.message });
  }
};

// ─── DELETE producto ──────────────────────────────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (err) {
    console.error('deleteProduct:', err);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
};

// ─── PATCH toggle isActive ────────────────────────────────────────────────────
const toggleProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    // No activar si no tiene stock
    if (!product.isActive && product.stock === 0) {
      return res.status(400).json({ error: 'No se puede activar un producto sin stock' });
    }

    product.isActive = !product.isActive;
    await product.save();

    res.json({
      message: `Producto ${product.isActive ? 'activado' : 'desactivado'}`,
      product,
    });
  } catch (err) {
    console.error('toggleProductStatus:', err);
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

    res.json({
      message: `Precio ahora en ${product.isUsd ? 'USD' : 'ARS'}`,
      product,
    });
  } catch (err) {
    console.error('toggleProductIsUsd:', err);
    res.status(500).json({ error: 'Error al cambiar moneda del producto' });
  }
};

// ─── PATCH toggle isPartnerOnly ───────────────────────────────────────────────
const togglePartnerOnly = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    product.isPartnerOnly = !product.isPartnerOnly;
    await product.save();

    res.json({
      message: `Producto ahora es ${product.isPartnerOnly ? 'exclusivo' : 'público'}`,
      product,
    });
  } catch (err) {
    console.error('togglePartnerOnly:', err);
    res.status(500).json({ error: 'Error al cambiar exclusividad del producto' });
  }
};

// ─── PATCH toggle toggleFeatured ───────────────────────────────────────────────
const toggleFeatured = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  product.isFeatured = !product.isFeatured;
  await product.save();
  res.json({ message: `Producto ${product.isFeatured ? 'destacado' : 'no destacado'}`, product });
};

// ─── POST restaurar stock ─────────────────────────────────────────────────────
const restoreStock = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    await product.increaseStock(Number(quantity));

    res.json({
      message: `Stock restaurado. Nuevo stock: ${product.stock}`,
      product,
    });
  } catch (err) {
    console.error('restoreStock:', err);
    res.status(400).json({ error: err.message });
  }
};

// ─── POST verificar stock ─────────────────────────────────────────────────────
const checkStock = async (req, res) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    res.json({
      hasStock: product.hasEnoughStock(Number(quantity)),
      available: product.stock,
      requested: Number(quantity),
    });
  } catch (err) {
    console.error('checkStock:', err);
    res.status(400).json({ error: err.message });
  }
};

// ─── GET debug (admin+) ───────────────────────────────────────────────────────
const debugProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    res.json({
      _id: product._id,
      title: product.title,
      stock: product.stock,
      price: product.price,
      isActive: product.isActive,
      isUsd: product.isUsd,
      rating: product.rating,
      numReviews: product.numReviews,
      cartRatingsCount: product.cartRatings?.length || 0,
      updatedAt: product.updatedAt,
    });
  } catch (err) {
    console.error('debugProduct:', err);
    res.status(500).json({ error: 'Error al obtener debug del producto' });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProductStatus,
  toggleProductIsUsd,
  togglePartnerOnly,
  toggleFeatured,
  restoreStock,
  checkStock,
  debugProduct,
};