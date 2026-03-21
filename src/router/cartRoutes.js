const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/cartController');

const { authenticate, isModerador } = require('../middlewares/authMiddleware');

// Todas requieren autenticación
router.use(authenticate);

// ─── Moderador+ ───────────────────────────────────────────────────────────────
router.get('/all', isModerador, getAllCarts);

// ─── Usuario ──────────────────────────────────────────────────────────────────
router.get('/user/:userId',        getCartsByUser);
router.get('/user/:userId/active', getActiveCart);
router.get('/:cartId',             getCartById);

// ─── Carrito ──────────────────────────────────────────────────────────────────
router.post('/',                        addToCart);
router.patch('/:cartId/item',           updateCartItem);
router.post('/:cartId/checkout',        checkoutCart);
router.put('/:cartId/receipt',          uploadReceipt);

// ─── Estado (moderador+) ─────────────────────────────────────────────────────
router.patch('/:cartId/status', isModerador, updateCartStatus);

// ─── Ratings ──────────────────────────────────────────────────────────────────
router.post('/:cartId/rate/:productId', addCartProductRating);

module.exports = router;