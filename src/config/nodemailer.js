// config/nodemailer.js - VERSIÓN MEJORADA PARA VERCEL
const nodemailer = require('nodemailer');

console.log('🔧 Configurando Nodemailer para Vercel...');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  // Configuración optimizada para Vercel
  connectionTimeout: 30000,
  greetingTimeout: 15000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false
  }
});

// Verificación opcional (puede comentarse si da problemas)
transporter.verify((error, success) => {
  if (error) {
    console.log('⚠️ Verificación SMTP opcional falló (puede ignorarse):', error.message);
  } else {
    console.log('✅ Servidor SMTP configurado correctamente');
  }
});

module.exports = transporter;