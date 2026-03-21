const jwt = require('jsonwebtoken');
const User = require('../models/User');

const HIERARCHY = ['usuario', 'moderador', 'admin', 'dios'];

// ─── Autenticación base ──────────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: token no enviado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -__v');

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = user; // documento Mongoose completo (tiene .isAtLeast, .canAssignRole)
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Por favor, renueva tu sesión.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido o malformado.' });
    }
    res.status(401).json({ error: 'Error de autenticación.' });
  }
};

// ─── Factory: requireRole('moderador') bloquea usuarios por debajo ───────────
const requireRole = (minRole) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!req.user.isAtLeast(minRole)) {
    return res.status(403).json({
      error: `Acceso denegado. Se requiere rol "${minRole}" o superior.`,
    });
  }
  next();
};

// ─── Shortcuts semánticos (opcionales pero cómodos en las rutas) ─────────────
const isModerador = requireRole('moderador'); // moderador, admin, dios
const isAdmin     = requireRole('admin');     // admin, dios
const isDios      = requireRole('dios');      // solo dios

// ─── Guard especial: asignación de roles ────────────────────────────────────
// Verifica que el usuario logueado puede asignar el rol que viene en req.body.role
const canAssignRole = (req, res, next) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Debe especificar un rol' });
  if (!HIERARCHY.includes(role)) return res.status(400).json({ error: 'Rol inválido' });

  if (!req.user.canAssignRole(role)) {
    return res.status(403).json({
      error: `No tenés permisos para asignar el rol "${role}". Tu rol es "${req.user.role}".`,
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireRole,
  isModerador,
  isAdmin,
  isDios,
  canAssignRole,
};