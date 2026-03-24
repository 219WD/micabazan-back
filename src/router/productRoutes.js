const express = require('express');
const router = express.Router();
const {
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
  reduceStockVariante,
  debugProduct,
} = require('../controllers/productController');

const { authenticate, isModerador, isAdmin } = require('../middlewares/authMiddleware');

// ─── Públicas ─────────────────────────────────────────────────────────────────
router.get('/',    getProducts);
router.get('/:id', getProductById);

// ─── Moderador+ ───────────────────────────────────────────────────────────────
router.post('/',   authenticate, isModerador, createProduct);
router.put('/:id', authenticate, isModerador, updateProduct);
router.delete('/:id', authenticate, isModerador, deleteProduct);

router.patch('/:id/toggle-status',    authenticate, isModerador, toggleProductStatus);
router.patch('/:id/toggle-usd',       authenticate, isModerador, toggleProductIsUsd);
router.patch('/:id/toggle-exclusive', authenticate, isModerador, togglePartnerOnly);
router.patch('/:id/toggle-featured',  authenticate, isModerador, toggleFeatured);

router.post('/:id/restore-stock',       authenticate, isModerador, restoreStock);
router.post('/:id/check-stock',         authenticate, checkStock);
router.patch('/:id/reduce-stock',       authenticate, reduceStockVariante);

// ─── Admin+ ───────────────────────────────────────────────────────────────────
router.get('/:id/debug', authenticate, isAdmin, debugProduct);

module.exports = router;