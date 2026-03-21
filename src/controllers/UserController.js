const mongoose = require('mongoose');
const User = require('../models/User');

// ─── Helper: respuesta segura (sin password) ─────────────────────────────────
const safeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profileImage: user.profileImage || null,
  savedAddress: user.savedAddress || null,
  createdAt: user.createdAt,
});

// ─── GET /users ──────────────────────────────────────────────────────────────
// Solo moderador+. Moderador ve la lista pero no puede cambiar roles desde acá.
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -__v').sort({ createdAt: -1 });
    res.status(200).json(users.map(safeUser));
  } catch (err) {
    console.error('getAllUsers:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

// ─── GET /users/:id ──────────────────────────────────────────────────────────
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -__v');
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.status(200).json(safeUser(user));
  } catch (err) {
    console.error('getUserById:', err);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
};

// ─── GET /users/search?q= ────────────────────────────────────────────────────
const searchUsers = async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Parámetro de búsqueda requerido' });

  try {
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    }).select('-password -__v').limit(20);

    res.status(200).json(users.map(safeUser));
  } catch (err) {
    console.error('searchUsers:', err);
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
};

// ─── PUT /users/:id ──────────────────────────────────────────────────────────
// El propio usuario edita su name, email y dirección guardada.
// Admin/dios pueden editar cualquier usuario.
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Solo el propio usuario o admin+ pueden editar
    const isSelf = req.user._id.toString() === id;
    if (!isSelf && !req.user.isAtLeast('admin')) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const { name, email, savedAddress } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Verificar email duplicado
    const emailTaken = await User.findOne({ email, _id: { $ne: id } });
    if (emailTaken) return res.status(400).json({ error: 'El email ya está en uso' });

    const updated = await User.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(savedAddress && { savedAddress }),
      },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!updated) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.status(200).json({ message: 'Usuario actualizado', user: safeUser(updated) });
  } catch (err) {
    console.error('updateUser:', err);
    res.status(500).json({ error: 'Error al actualizar usuario', details: err.message });
  }
};

// ─── PATCH /users/:id/role ───────────────────────────────────────────────────
// Cambia el rol de un usuario.
// El guard `canAssignRole` del middleware ya verificó que el rol es asignable.
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // No podés cambiar tu propio rol
    if (req.user._id.toString() === id) {
      return res.status(400).json({ error: 'No podés cambiar tu propio rol' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Tampoco podés bajarle el rol a alguien de igual o mayor jerarquía
    if (!req.user.canAssignRole(target.role)) {
      return res.status(403).json({
        error: `No podés modificar el rol de un usuario con rol "${target.role}"`,
      });
    }

    target.role = role;
    await target.save();

    res.status(200).json({
      message: `Rol actualizado a "${role}"`,
      user: safeUser(target),
    });
  } catch (err) {
    console.error('updateUserRole:', err);
    res.status(500).json({ error: 'Error al actualizar rol', details: err.message });
  }
};

// ─── DELETE /users/:id ───────────────────────────────────────────────────────
// Solo admin+. No podés eliminarte a vos mismo. No podés eliminar a alguien de rol >= tuyo.
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user._id.toString() === id) {
      return res.status(400).json({ error: 'No podés eliminarte a vos mismo' });
    }

    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!req.user.canAssignRole(target.role)) {
      return res.status(403).json({
        error: `No podés eliminar a un usuario con rol "${target.role}"`,
      });
    }

    await target.deleteOne();
    res.status(200).json({ message: 'Usuario eliminado correctamente' });
  } catch (err) {
    console.error('deleteUser:', err);
    res.status(500).json({ error: 'Error al eliminar usuario', details: err.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  searchUsers,
  updateUser,
  updateUserRole,
  deleteUser,
};