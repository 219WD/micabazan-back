// middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');

// ✅ SOLUCIÓN: Usar memoryStorage en lugar de diskStorage para Vercel
const storage = multer.memoryStorage(); // <- Cambio crucial

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, JPG)'), false);
  }
};

const upload = multer({
  storage: storage, // ✅ Usa memoria, no sistema de archivos
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// ✅ Middleware para procesar archivos en memoria
const processUpload = (req, res, next) => {
  // Si hay archivo en memoria, crear un objeto similar al de diskStorage
  if (req.file) {
    req.file.processed = true;
    console.log('📁 Archivo en memoria listo para Cloudinary');
  }
  next();
};

// ❌ ELIMINAR: El middleware cleanupTempFiles ya no es necesario
// porque no creamos archivos temporales

module.exports = { upload, processUpload };