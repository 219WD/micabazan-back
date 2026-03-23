const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const server = express();
    
// ─── Importación de rutas ────────────────────────────────────────────────────
const RegisterRouter    = require("./router/Register");
const LoginRouter       = require("./router/Login");
const AuthRouter        = require("./router/authRoutes");
const UserRouter        = require("./router/UserRoutes");
const ProductRouter     = require("./router/productRoutes");
const CartRouter        = require("./router/cartRoutes");
const MercadoPagoRouter = require("./router/Mercado_Pago_Router");
const UploadRouter = require("./router/uploadRoutes");

// ─── Conexión a MongoDB ──────────────────────────────────────────────────────
const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  try {
    await mongoose.connect(process.env.MONGODB, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("🟢 Conectado a MongoDB");
  } catch (err) {
    console.error("❌ Error al conectar con MongoDB:", err.message);
    throw err;
  }
};

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  process.env.PRODUCTION_URL,
].filter(Boolean);

server.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (Postman, mobile apps, etc.)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("No permitido por CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Body parser ─────────────────────────────────────────────────────────────
server.use(express.json());

// ─── Middleware de conexión DB ────────────────────────────────────────────────
server.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    res.status(500).json({ error: "No se pudo conectar a la base de datos" });
  }
});

// ─── Rate limiters ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: "Demasiadas solicitudes desde esta IP, intentá en 15 minutos" },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // más generoso que antes para no frenar compras
  message: { error: "Demasiados intentos, intentá en 15 minutos" },
  standardHeaders: true,
  legacyHeaders: false,
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Límite de solicitudes de pago alcanzado" },
  standardHeaders: true,
  legacyHeaders: false,
});

server.use(generalLimiter);

// Rate limiters específicos por ruta
server.use("/register", authLimiter);
server.use("/login",    authLimiter);
server.use("/auth/reset-password-request", authLimiter);
server.use("/auth/reset-password",         authLimiter);
server.use("/mercadopago",                 paymentLimiter);

// ─── Rutas ───────────────────────────────────────────────────────────────────
server.use("/register",    RegisterRouter);
server.use("/login",       LoginRouter);
server.use("/auth",        AuthRouter);
server.use("/users",       UserRouter);
server.use("/products",    ProductRouter);
server.use("/cart",        CartRouter);
server.use("/mercadopago", MercadoPagoRouter);
server.use("/upload", UploadRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
server.get("/health", (req, res) => {
  res.json({
    status: "ok",
    db: mongoose.connections[0].readyState === 1 ? "connected" : "disconnected",
    env: process.env.NODE_ENV || "development",
  });
});

// ─── 404 ─────────────────────────────────────────────────────────────────────
server.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

// ─── Error handler global ─────────────────────────────────────────────────────
server.use((err, req, res, next) => {
  console.error("💥 Error no manejado:", err);

  if (err.message === "No permitido por CORS") {
    return res.status(403).json({ error: "Origen no permitido" });
  }

  res.status(err.status || 500).json({
    error: err.message || "Error interno del servidor",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = server;