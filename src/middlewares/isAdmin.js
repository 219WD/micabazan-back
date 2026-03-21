const jwt = require('jsonwebtoken');
const User = require('../models/User');

const isAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado: token no enviado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: 'Acceso denegado: solo para administradores' });
    }

    req.user = user; // opcional si necesitas el admin luego
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

module.exports = isAdmin;
