const express = require('express');
const { check } = require('express-validator');
const expressValidations = require('../middlewares/expressValidations');
const { authenticate } = require('../middlewares/authMiddleware');

const {
  requestResetPassword,
  resetPassword,
  changePassword,
} = require('../controllers/authController');

const {
  getMe,
  updateMe,
  updateMyAddress,
  deleteMyAddress,
} = require('../controllers/profileController.js');

const router = express.Router();

// ════════════════════════════════════════════════════════════
// CONTRASEÑA — sin autenticación (flujo de recuperación)
// ════════════════════════════════════════════════════════════

// POST /auth/reset-password-request
router.post(
  '/reset-password-request',
  [
    check('email', 'El email es requerido').notEmpty(),
    check('email', 'Debe tener formato de email').isEmail(),
  ],
  expressValidations,
  requestResetPassword
);

// POST /auth/reset-password/:token
router.post(
  '/reset-password/:token',
  [
    check('newPassword', 'La contraseña es requerida').notEmpty(),
    check('newPassword', 'Debe tener al menos 6 caracteres').isLength({ min: 6 }),
  ],
  expressValidations,
  resetPassword
);

// ════════════════════════════════════════════════════════════
// CONTRASEÑA — logueado (desde perfil)
// ════════════════════════════════════════════════════════════

// POST /auth/change-password
router.post(
  '/change-password',
  authenticate,
  [
    check('currentPassword', 'La contraseña actual es requerida').notEmpty(),
    check('newPassword', 'La nueva contraseña es requerida').notEmpty(),
    check('newPassword', 'Debe tener al menos 6 caracteres').isLength({ min: 6 }),
  ],
  expressValidations,
  changePassword
);

// ════════════════════════════════════════════════════════════
// PERFIL — rutas /auth/me
// ════════════════════════════════════════════════════════════

// GET /auth/me → datos del usuario + últimos pedidos
router.get('/me', authenticate, getMe);

// PUT /auth/me → actualizar name y/o email
router.put(
  '/me',
  authenticate,
  [
    check('name', 'El nombre no puede estar vacío').optional().notEmpty(),
    check('email', 'Debe tener formato de email').optional().isEmail(),
  ],
  expressValidations,
  updateMe
);

// PUT /auth/me/address → guardar/actualizar dirección del perfil
router.put(
  '/me/address',
  authenticate,
  [
    check('phone', 'El teléfono debe ser un string').optional().isString(),
    check('postalCode', 'El código postal debe ser un string').optional().isString(),
  ],
  expressValidations,
  updateMyAddress
);

// DELETE /auth/me/address → borrar dirección guardada
router.delete('/me/address', authenticate, deleteMyAddress);

module.exports = router;