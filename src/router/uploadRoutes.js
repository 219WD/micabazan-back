const express = require('express');
const router = express.Router();
const cloudinary = require('../config/cloudinary');
const { authenticate, isModerador } = require('../middlewares/authMiddleware');

// ─── POST /upload/signature ───────────────────────────────────────────────────
// Genera una firma para que el frontend pueda subir directo a Cloudinary
// Solo moderador+ puede subir imágenes de productos
router.post('/signature', authenticate, isModerador, (req, res) => {
  try {
    const { folder = 'productos' } = req.body;

    const timestamp = Math.round(new Date().getTime() / 1000);

    const paramsToSign = {
      timestamp,
      folder,
      // Transformaciones automáticas al subir
      eager: 'c_limit,w_1200,q_auto,f_auto',
    };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      folder,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
    });
  } catch (err) {
    console.error('Error generando firma Cloudinary:', err);
    res.status(500).json({ error: 'Error al generar firma de upload' });
  }
});

// ─── DELETE /upload ────────────────────────────────────────────────────────────
// Elimina una imagen de Cloudinary por su public_id
// Se usa cuando el moderador reemplaza o borra una foto
router.delete('/', authenticate, isModerador, async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) return res.status(400).json({ error: 'publicId requerido' });

    await cloudinary.uploader.destroy(publicId);
    res.json({ message: 'Imagen eliminada' });
  } catch (err) {
    console.error('Error eliminando imagen:', err);
    res.status(500).json({ error: 'Error al eliminar imagen' });
  }
});

module.exports = router;