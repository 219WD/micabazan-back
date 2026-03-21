const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// POST /register
// Campos mínimos: name, email, password — nada más.
// Crea la cuenta Y devuelve el token en el mismo paso (sin obligar a hacer login después).
router.post('/', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Ya existe una cuenta con ese email.' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
      role: 'usuario',
    });

    // ─── Devolver token igual que en login para no interrumpir el flujo ───
    const payload = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Cuenta creada exitosamente.',
      token,
      user: payload,
    });
  } catch (err) {
    console.error('register:', err);
    res.status(500).json({ error: 'Error al registrar usuario.' });
  }
});

module.exports = router;