// utils/cloudinaryUtils.js
const cloudinary = require('../config/cloudinary');
const QRCode = require('qrcode');

// Subir imagen desde buffer (para Vercel)
const uploadToCloudinary = async (fileBuffer, folder = 'profiles', originalname = 'image') => {
  try {
    console.log('☁️ Subiendo buffer a Cloudinary...');
    
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: `profile-${Date.now()}`,
          quality: 'auto',
          fetch_format: 'auto'
        },
        (error, result) => {
          if (error) {
            console.error('❌ Error subiendo a Cloudinary:', error);
            reject(new Error(`Error subiendo a Cloudinary: ${error.message}`));
          } else {
            console.log('✅ Cloudinary upload success:', result.secure_url);
            resolve(result);
          }
        }
      );
      
      // Escribir el buffer en el stream de upload
      uploadStream.end(fileBuffer);
    });
  } catch (error) {
    console.error('❌ Error en uploadToCloudinary:', error);
    throw error;
  }
};

// Eliminar imagen de Cloudinary (sin cambios)
const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) return;
    
    // Extraer public_id de la URL si es necesario
    const urlParts = publicId.split('/');
    const filename = urlParts[urlParts.length - 1];
    const publicIdWithoutExtension = filename.split('.')[0];
    const fullPublicId = `profiles/${publicIdWithoutExtension}`;
    
    await cloudinary.uploader.destroy(fullPublicId);
    console.log('✅ Imagen eliminada de Cloudinary');
  } catch (error) {
    console.error('Error eliminando de Cloudinary:', error);
  }
};

// Generar QR y subirlo a Cloudinary (sin cambios)
const generateAndUploadQR = async (userId, userData) => {
  try {
    // ✅ CAMBIAR: En lugar de JSON, usar URL directa
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrData = `${frontendUrl}/credencial/${userId}`;

    console.log('🔗 Generando QR con URL:', qrData);

    // Generar QR como buffer
    const qrBuffer = await QRCode.toBuffer(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Subir QR a Cloudinary
    const qrResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'qrcodes',
          public_id: `user_${userId}_qr`,
          format: 'png'
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(qrBuffer);
    });

    console.log('✅ QR generado y subido:', qrResult.secure_url);
    return qrResult.secure_url;
  } catch (error) {
    throw new Error(`Error generando QR: ${error.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
  generateAndUploadQR
};