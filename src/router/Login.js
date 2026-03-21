const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST /login
router.post('/', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas.' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Credenciales inválidas.' });

    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login exitoso.', token, user: payload });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ error: 'Error del servidor.' });
  }
});

// POST /login/renew-token
router.post('/renew-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || null,
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ message: 'Token renovado.', token: newToken, user: payload });
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Error al renovar token.' });
  }
});

module.exports = router;