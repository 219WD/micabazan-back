const bcrypt = require('bcrypt');
const User = require('../models/User');
const Cart = require('../models/Cart');

// ─── Helper ──────────────────────────────────────────────────────────────────
const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || null,
  savedAddress: user.savedAddress || null,
  createdAt: user.createdAt,
});

// ─── GET /profile/me ─────────────────────────────────────────────────────────
// Mismo endpoint para todos los roles.
// Devuelve datos del usuario + últimos pedidos siempre.
// Rol moderador+ recibe además un resumen de actividad propia.
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -__v');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Últimos 5 pedidos del usuario (siempre)
    const recentOrders = await Cart.find({
      userId: user._id,
      status: { $ne: 'inicializado' }, // solo los que ya pasaron por checkout
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .populate('items.productId', 'title image price')
      .select('status totalAmount paymentMethod deliveryMethod createdAt updatedAt shippingAddress');

    const response = {
      user: safeUser(user),
      recentOrders,
    };

    res.status(200).json(response);
  } catch (err) {
    console.error('getMe:', err);
    res.status(500).json({ error: 'Error al obtener el perfil.' });
  }
};

// ─── PUT /profile/me ─────────────────────────────────────────────────────────
// Actualiza name y/o email del usuario logueado
const updateMe = async (req, res) => {
  const { name, email } = req.body;

  if (!name && !email) {
    return res.status(400).json({ error: 'Enviá al menos un campo para actualizar.' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    if (email && email !== user.email) {
      const taken = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: user._id } });
      if (taken) return res.status(400).json({ error: 'El email ya está en uso.' });
      user.email = email.trim().toLowerCase();
    }

    if (name) user.name = name.trim();

    await user.save();

    res.status(200).json({ message: 'Perfil actualizado.', user: safeUser(user) });
  } catch (err) {
    console.error('updateMe:', err);
    res.status(500).json({ error: 'Error al actualizar perfil.' });
  }
};

// ─── PUT /profile/me/address ──────────────────────────────────────────────────
// Guarda o actualiza la dirección del perfil (independiente del checkout)
// Campos pensados para envíos dentro de Argentina
const updateMyAddress = async (req, res) => {
  const { name, address, city, province, postalCode, phone } = req.body;

  // Al menos uno tiene que venir
  const hasAny = name || address || city || province || postalCode || phone;
  if (!hasAny) {
    return res.status(400).json({ error: 'Enviá al menos un campo de dirección.' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Merge parcial: solo pisa los campos que llegaron
    user.savedAddress = {
      name:       name       ?? user.savedAddress?.name       ?? null,
      address:    address    ?? user.savedAddress?.address    ?? null,
      city:       city       ?? user.savedAddress?.city       ?? null,
      province:   province   ?? user.savedAddress?.province   ?? null,
      postalCode: postalCode ?? user.savedAddress?.postalCode ?? null,
      phone:      phone      ?? user.savedAddress?.phone      ?? null,
    };

    await user.save();

    res.status(200).json({
      message: 'Dirección actualizada.',
      savedAddress: user.savedAddress,
    });
  } catch (err) {
    console.error('updateMyAddress:', err);
    res.status(500).json({ error: 'Error al actualizar la dirección.' });
  }
};

// ─── DELETE /profile/me/address ───────────────────────────────────────────────
const deleteMyAddress = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      savedAddress: {
        name: null, address: null, city: null,
        province: null, postalCode: null, phone: null,
      },
    });
    res.status(200).json({ message: 'Dirección eliminada.' });
  } catch (err) {
    console.error('deleteMyAddress:', err);
    res.status(500).json({ error: 'Error al eliminar la dirección.' });
  }
};

module.exports = {
  getMe,
  updateMe,
  updateMyAddress,
  deleteMyAddress,
};