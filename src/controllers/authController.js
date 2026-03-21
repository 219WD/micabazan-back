const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const {
  sendPasswordResetRequestEmail,
  sendPasswordResetConfirmationEmail,
} = require('../utils/emailSender');

// ─── POST /auth/reset-password-request ───────────────────────────────────────
// No revela si el email existe o no (seguridad)
const requestResetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'El email es requerido' });

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Siempre respondemos lo mismo, exista o no el usuario
    if (!user) {
      return res.status(200).json({
        message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
      });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await sendPasswordResetRequestEmail(user, token);

    res.status(200).json({
      message: 'Si el email existe, recibirás un enlace para restablecer tu contraseña.',
    });
  } catch (err) {
    console.error('requestResetPassword:', err);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};

// ─── POST /auth/reset-password/:token ────────────────────────────────────────
// El link del email trae el token, se valida y se cambia la contraseña
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await sendPasswordResetConfirmationEmail(user);

    res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'El enlace expiró. Solicitá uno nuevo.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Enlace inválido.' });
    }
    console.error('resetPassword:', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña.' });
  }
};

// ─── POST /auth/change-password ───────────────────────────────────────────────
// Usuario logueado cambia su contraseña desde el perfil
// Requiere contraseña actual para confirmar identidad
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'La contraseña actual y la nueva son requeridas.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser distinta a la actual.' });
  }

  try {
    // Traemos el usuario CON password (por eso no usamos req.user directo)
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await sendPasswordResetConfirmationEmail(user);

    res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    console.error('changePassword:', err);
    res.status(500).json({ error: 'Error al cambiar la contraseña.' });
  }
};

module.exports = {
  requestResetPassword,
  resetPassword,
  changePassword,
};