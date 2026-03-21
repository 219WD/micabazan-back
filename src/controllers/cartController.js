const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const {
  sendPedidoConfirmadoEmail,
  sendPagoConfirmadoEmail,
  sendEnPreparacionEmail,
  sendEnCaminoEmail,
  sendPedidoEntregadoEmail,
} = require('../utils/emailSender');

// ─── Helper: verificar permisos sobre un carrito ──────────────────────────────
const canAccessCart = (req, cart) => {
  return (
    req.user._id.toString() === cart.userId.toString() ||
    req.user.isAtLeast('moderador')
  );
};

// ─── Helper: poblar carrito ───────────────────────────────────────────────────
const populateCart = (query) =>
  query
    .populate('items.productId', 'title image price isActive')
    .populate('userId', 'name email');

// ════════════════════════════════════════════════════════════════════════════════
// GET /cart/all — todos los carritos (moderador+)
// ════════════════════════════════════════════════════════════════════════════════
const getAllCarts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const carts = await populateCart(
      Cart.find(filter).sort({ updatedAt: -1 })
    )
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Cart.countDocuments(filter);

    res.json({ carts, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('getAllCarts:', err);
    res.status(500).json({ error: 'Error al obtener carritos' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// GET /cart/user/:userId — historial de pedidos de un usuario
// ════════════════════════════════════════════════════════════════════════════════
const getCartsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() !== userId && !req.user.isAtLeast('moderador')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const carts = await populateCart(
      Cart.find({ userId }).sort({ createdAt: -1 })
    );

    res.json(carts);
  } catch (err) {
    console.error('getCartsByUser:', err);
    res.status(500).json({ error: 'Error al obtener carritos del usuario' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// GET /cart/user/:userId/active — carrito activo (inicializado) del usuario
// ════════════════════════════════════════════════════════════════════════════════
const getActiveCart = async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user._id.toString() !== userId && !req.user.isAtLeast('moderador')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    let cart = await populateCart(
      Cart.findOne({ userId, status: 'inicializado' }).sort({ updatedAt: -1 })
    );

    if (!cart) return res.json(null); // sin carrito activo — el frontend lo maneja

    // Limpiar items huérfanos (producto eliminado)
    const before = cart.items.length;
    cart.items = cart.items.filter((item) => item.productId !== null);
    if (cart.items.length !== before) {
      cart.recalculateTotal();
      await cart.save();
    }

    res.json(cart);
  } catch (err) {
    console.error('getActiveCart:', err);
    res.status(500).json({ error: 'Error al obtener el carrito activo' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// GET /cart/:cartId — un carrito por ID
// ════════════════════════════════════════════════════════════════════════════════
const getCartById = async (req, res) => {
  try {
    const cart = await populateCart(Cart.findById(req.params.cartId));
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (!canAccessCart(req, cart)) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    res.json(cart);
  } catch (err) {
    console.error('getCartById:', err);
    res.status(500).json({ error: 'Error al obtener el carrito' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// POST /cart — agregar/actualizar ítem en carrito activo
// Crea el carrito si no existe. No requiere registro obligatorio.
// ════════════════════════════════════════════════════════════════════════════════
const addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = req.user._id;

    if (!productId) return res.status(400).json({ error: 'productId es requerido' });
    if (quantity < 1) return res.status(400).json({ error: 'La cantidad mínima es 1' });

    // Verificar producto
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
    if (!product.isActive) return res.status(400).json({ error: 'Producto no disponible' });
    if (!product.hasEnoughStock(quantity)) {
      return res.status(400).json({
        error: `Stock insuficiente. Disponible: ${product.stock}`,
      });
    }

    // Buscar carrito activo o crear uno nuevo
    let cart = await Cart.findOne({ userId, status: 'inicializado' });

    if (!cart) {
      cart = new Cart({ userId, items: [], totalAmount: 0 });
    }

    // Cancelar TTL de abandonado si el usuario volvió
    if (cart.expiresAt) {
      cart.expiresAt = null;
      cart.abandonedEmailSent = false;
    }

    // Agregar o sumar cantidad
    const existingIndex = cart.items.findIndex(
      (i) => i.productId.toString() === productId
    );

    if (existingIndex !== -1) {
      const newQty = cart.items[existingIndex].quantity + Number(quantity);
      if (!product.hasEnoughStock(newQty)) {
        return res.status(400).json({
          error: `Stock insuficiente. Disponible: ${product.stock}, en carrito: ${cart.items[existingIndex].quantity}`,
        });
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].priceAtPurchase = product.price; // actualizar precio
    } else {
      cart.items.push({
        productId,
        quantity: Number(quantity),
        priceAtPurchase: product.price,
      });
    }

    cart.recalculateTotal();
    await cart.save();

    await cart.populate('items.productId', 'title image price isActive');
    res.status(200).json(cart);
  } catch (err) {
    console.error('addToCart:', err);
    res.status(500).json({ error: 'Error al agregar al carrito', details: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// PATCH /cart/:cartId/item — modificar cantidad o eliminar ítem
// action: 'add' | 'subtract' | 'remove' | 'set'
// ════════════════════════════════════════════════════════════════════════════════
const updateCartItem = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { productId, action, quantity } = req.body;

    if (!productId || !action) {
      return res.status(400).json({ error: 'productId y action son requeridos' });
    }

    const cart = await Cart.findById(cartId);
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (!canAccessCart(req, cart)) return res.status(403).json({ error: 'No autorizado' });
    if (!cart.isEditable()) {
      return res.status(400).json({ error: `No se puede modificar un carrito en estado "${cart.status}"` });
    }

    const itemIndex = cart.items.findIndex(
      (i) => i.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Ítem no encontrado en el carrito' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const item = cart.items[itemIndex];

    if (action === 'add') {
      const newQty = item.quantity + 1;
      if (!product.hasEnoughStock(newQty)) {
        return res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.stock}` });
      }
      item.quantity = newQty;

    } else if (action === 'subtract') {
      item.quantity -= 1;
      if (item.quantity <= 0) cart.items.splice(itemIndex, 1);

    } else if (action === 'remove') {
      cart.items.splice(itemIndex, 1);

    } else if (action === 'set') {
      if (!quantity || quantity < 1) {
        return res.status(400).json({ error: 'quantity debe ser >= 1 para action "set"' });
      }
      if (!product.hasEnoughStock(Number(quantity))) {
        return res.status(400).json({ error: `Stock insuficiente. Disponible: ${product.stock}` });
      }
      item.quantity = Number(quantity);

    } else {
      return res.status(400).json({ error: 'action inválida. Usar: add, subtract, remove, set' });
    }

    cart.recalculateTotal();
    await cart.save();

    await cart.populate('items.productId', 'title image price isActive');
    res.json({ message: 'Carrito actualizado', cart });
  } catch (err) {
    console.error('updateCartItem:', err);
    res.status(500).json({ error: 'Error al actualizar el carrito', details: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// POST /cart/:cartId/checkout — confirmar pedido
// ════════════════════════════════════════════════════════════════════════════════
const checkoutCart = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { paymentMethod, deliveryMethod, shippingAddress, receiptUrl } = req.body;

    // Validaciones básicas
    if (!paymentMethod || !['transferencia', 'mercadopago'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'paymentMethod debe ser "transferencia" o "mercadopago"' });
    }
    if (!deliveryMethod || !['retiro', 'envio'].includes(deliveryMethod)) {
      return res.status(400).json({ error: 'deliveryMethod debe ser "retiro" o "envio"' });
    }
    if (deliveryMethod === 'envio') {
      const { name, address, city, province, postalCode, phone } = shippingAddress || {};
      if (!name || !address || !city || !province || !postalCode || !phone) {
        return res.status(400).json({ error: 'Todos los campos de dirección son obligatorios para envío' });
      }
    }

    const cart = await Cart.findById(cartId).populate('items.productId');
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (!canAccessCart(req, cart)) return res.status(403).json({ error: 'No autorizado' });
    if (!cart.canCheckout()) {
      return res.status(400).json({ error: `No se puede hacer checkout de un carrito en estado "${cart.status}"` });
    }

    // Limpiar huérfanos
    cart.items = cart.items.filter((item) => item.productId !== null);
    if (cart.items.length === 0) {
      return res.status(400).json({ error: 'El carrito no tiene productos válidos' });
    }

    // Verificar stock de todos los items antes de descontarlo
    for (const item of cart.items) {
      const product = item.productId;
      if (!product.isActive) {
        return res.status(400).json({ error: `El producto "${product.title}" ya no está disponible` });
      }
      if (!product.hasEnoughStock(item.quantity)) {
        return res.status(400).json({
          error: `Stock insuficiente para "${product.title}". Disponible: ${product.stock}, solicitado: ${item.quantity}`,
        });
      }
    }

    // Descontar stock
    for (const item of cart.items) {
      await item.productId.reduceStock(item.quantity);
    }

    // Actualizar carrito
    cart.paymentMethod  = paymentMethod;
    cart.deliveryMethod = deliveryMethod;
    cart.shippingAddress = deliveryMethod === 'envio' ? shippingAddress : null;
    cart.expiresAt      = null;  // cancelar TTL de abandonado
    cart.abandonedEmailSent = false;

    if (receiptUrl) cart.receiptUrl = receiptUrl;

    // Estado inicial según método de pago
    // mercadopago → el webhook lo pasa a 'pagado' automáticamente
    // transferencia → queda en 'pendiente' hasta que admin confirme
    cart.status = paymentMethod === 'mercadopago' ? 'pagado' : 'pendiente';

    // Recalcular total final con priceAtPurchase (snapshot)
    cart.recalculateTotal();
    await cart.save();

    // Email de confirmación
    try {
      const user = await User.findById(cart.userId);
      await sendPedidoConfirmadoEmail(cart, user);
    } catch (emailErr) {
      console.error('Error enviando email de confirmación:', emailErr.message);
    }

    await cart.populate('items.productId', 'title image price');
    res.status(200).json(cart);
  } catch (err) {
    console.error('checkoutCart:', err);
    res.status(500).json({ error: 'Error al procesar el checkout', details: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// PATCH /cart/:cartId/status — cambiar estado (moderador+)
// ════════════════════════════════════════════════════════════════════════════════
const updateCartStatus = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pendiente', 'pagado', 'preparacion', 'en_camino', 'entregado', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Estado inválido. Válidos: ${validStatuses.join(', ')}` });
    }

    const cart = await Cart.findById(cartId)
      .populate('items.productId')
      .populate('userId', 'name email');

    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    const prev = cart.status;

    // Validaciones de flujo
    if (prev === 'entregado') {
      return res.status(400).json({ error: 'No se puede modificar un pedido ya entregado' });
    }
    if (prev === 'cancelado') {
      return res.status(400).json({ error: 'No se puede modificar un pedido cancelado' });
    }
    if (status === 'en_camino' && cart.deliveryMethod !== 'envio') {
      return res.status(400).json({ error: 'El estado "en_camino" solo aplica a pedidos con envío' });
    }
    if (status === 'preparacion' && !['pagado', 'pendiente'].includes(prev)) {
      return res.status(400).json({ error: 'Solo se puede pasar a preparación desde "pagado" o "pendiente"' });
    }

    const prevStatus = cart.status;
    cart.status = status;
    await cart.save();

    // Restaurar stock si se cancela
    const statusesWithReducedStock = ['pendiente', 'pagado', 'preparacion', 'en_camino'];
    if (status === 'cancelado' && statusesWithReducedStock.includes(prevStatus)) {
      for (const item of cart.items) {
        const product = item.productId;
        if (!product) continue;
        product.stock += item.quantity;
        if (!product.isActive && product.stock > 0) product.isActive = true;
        await product.save();
        console.log(`✅ Stock restaurado: ${product.title} +${item.quantity} (ahora: ${product.stock})`);
      }
    }

    // Emails según nuevo estado
    try {
      const user = cart.userId;
      if (status !== prevStatus) {
        if (status === 'pagado' && prevStatus === 'pendiente') {
          await sendPagoConfirmadoEmail(cart, user);
        } else if (status === 'preparacion') {
          await sendEnPreparacionEmail(cart, user);
        } else if (status === 'en_camino') {
          await sendEnCaminoEmail(cart, user);
        } else if (status === 'entregado') {
          await sendPedidoEntregadoEmail(cart, user);
        }
      }
    } catch (emailErr) {
      console.error('Error enviando email de estado:', emailErr.message);
    }

    res.json(cart);
  } catch (err) {
    console.error('updateCartStatus:', err);
    res.status(500).json({ error: 'Error al actualizar estado', details: err.message });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// PUT /cart/:cartId/receipt — subir comprobante de transferencia
// ════════════════════════════════════════════════════════════════════════════════
const uploadReceipt = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { receiptUrl } = req.body;

    if (!receiptUrl) return res.status(400).json({ error: 'receiptUrl es requerido' });

    const cart = await Cart.findById(cartId);
    if (!cart) return res.status(404).json({ error: 'Carrito no encontrado' });

    if (!canAccessCart(req, cart)) return res.status(403).json({ error: 'No autorizado' });

    if (cart.paymentMethod !== 'transferencia') {
      return res.status(400).json({ error: 'Este pedido no es por transferencia' });
    }
    if (!['pendiente'].includes(cart.status)) {
      return res.status(400).json({ error: 'Solo se puede subir comprobante en pedidos pendientes' });
    }

    cart.receiptUrl = receiptUrl;
    await cart.save();

    res.json({ message: 'Comprobante guardado correctamente', cart });
  } catch (err) {
    console.error('uploadReceipt:', err);
    res.status(500).json({ error: 'Error al guardar comprobante' });
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// POST /cart/:cartId/rate/:productId — calificar producto post-entrega
// ════════════════════════════════════════════════════════════════════════════════
const addCartProductRating = async (req, res) => {
  try {
    const { cartId, productId } = req.params;
    const { stars, comment } = req.body;

    if (!stars || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'stars debe ser entre 1 y 5' });
    }

    const cart = await Cart.findById(cartId);
    const product = await Product.findById(productId);

    if (!cart || !product) return res.status(404).json({ error: 'Carrito o producto no encontrado' });

    if (req.user._id.toString() !== cart.userId.toString()) {
      return res.status(403).json({ error: 'Solo el comprador puede calificar' });
    }
    if (cart.status !== 'entregado') {
      return res.status(400).json({ error: 'Solo podés calificar pedidos entregados' });
    }

    const inCart = cart.items.some((i) => i.productId.toString() === productId);
    if (!inCart) {
      return res.status(400).json({ error: 'Ese producto no está en este pedido' });
    }

    // Guardar rating en el producto
    await product.addCartRating(cartId, Number(stars), comment);

    // Guardar rating en el carrito
    const existingIndex = cart.ratings.findIndex(
      (r) => r.productId.toString() === productId
    );
    if (existingIndex !== -1) {
      cart.ratings[existingIndex] = { productId, stars: Number(stars), comment, ratedAt: new Date() };
    } else {
      cart.ratings.push({ productId, stars: Number(stars), comment });
    }
    await cart.save();

    res.json({
      message: 'Calificación guardada',
      productRating: { rating: product.rating, numReviews: product.numReviews },
    });
  } catch (err) {
    console.error('addCartProductRating:', err);
    res.status(500).json({ error: 'Error al calificar', details: err.message });
  }
};

module.exports = {
  getAllCarts,
  getCartsByUser,
  getActiveCart,
  getCartById,
  addToCart,
  updateCartItem,
  checkoutCart,
  updateCartStatus,
  uploadReceipt,
  addCartProductRating,
};