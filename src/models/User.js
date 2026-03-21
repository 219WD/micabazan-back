const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String,
    default: null,
  },
  role: {
    type: String,
    enum: ['usuario', 'moderador', 'admin', 'dios'],
    default: 'usuario',
  },

  // Dirección guardada — se pre-rellena en checkout si existe
  // Independiente: el usuario la gestiona desde su perfil,
  // el checkout puede usarla o pedir una distinta
  savedAddress: {
    name:         { type: String, default: null }, // nombre del receptor
    address:      { type: String, default: null }, // calle y número
    apartment:    { type: String, default: null }, // piso/dpto (opcional)
    city:         { type: String, default: null }, // localidad
    province:     { type: String, default: null }, // provincia
    postalCode:   { type: String, default: null }, // código postal
    phone:        { type: String, default: null }, // teléfono de contacto
    extraNotes:   { type: String, default: null }, // referencias / indicaciones
  },

}, { timestamps: true });

// ─── Helpers de rol ─────────────────────────────────────────────────────────
const HIERARCHY = ['usuario', 'moderador', 'admin', 'dios'];

// ¿Este user tiene al menos el rol X?
UserSchema.methods.isAtLeast = function (role) {
  return HIERARCHY.indexOf(this.role) >= HIERARCHY.indexOf(role);
};

// ¿Este user puede asignar el rol Y a otro?
// Regla: solo podés asignar roles ESTRICTAMENTE menores al tuyo
UserSchema.methods.canAssignRole = function (targetRole) {
  return HIERARCHY.indexOf(this.role) > HIERARCHY.indexOf(targetRole);
};

module.exports = mongoose.model('User', UserSchema);