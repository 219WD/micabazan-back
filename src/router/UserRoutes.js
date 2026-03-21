const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  searchUsers,
  updateUser,
  updateUserRole,
  deleteUser,
} = require('../controllers/UserController');

const {
  authenticate,
  isModerador,
  isAdmin,
  isDios,
  canAssignRole,
} = require('../middlewares/authMiddleware');

// ─── Listar y buscar (moderador+) ────────────────────────────────────────────
router.get('/', authenticate, isModerador, getAllUsers);
router.get('/search', authenticate, isModerador, searchUsers);

// ─── Ver un usuario ──────────────────────────────────────────────────────────
// El propio usuario o moderador+ pueden ver el perfil
router.get('/:id', authenticate, getUserById);

// ─── Editar datos propios (name, email, savedAddress) ───────────────────────
// La lógica de "solo el propio user o admin+" está en el controller
router.put('/:id', authenticate, updateUser);

// ─── Cambiar rol ─────────────────────────────────────────────────────────────
// isAdmin asegura que solo admin/dios lleguen, canAssignRole valida la jerarquía
router.patch('/:id/role', authenticate, isAdmin, canAssignRole, updateUserRole);

// ─── Eliminar usuario (admin+) ───────────────────────────────────────────────
router.delete('/:id', authenticate, isAdmin, deleteUser);

module.exports = router;