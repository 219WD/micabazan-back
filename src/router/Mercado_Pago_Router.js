const { Router } = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const dotenv = require("dotenv");
dotenv.config();

const Mercado_Pago = Router();

const client = new MercadoPagoConfig({
  accessToken: process.env.ACCESS_TOKEN,
});

Mercado_Pago.post("/pagar", async (req, res) => {
  const items = req.body;

  try {
    console.log("Recibiendo items:", items);

    if (!items || items.length === 0) {
      return res.status(400).json({
        error: "El carrito está vacío",
        details: "No se recibieron items para procesar el pago"
      });
    }
   
    const validatedItems = items.map((item, index) => {
      if (!item.title || !item.price || !item.quantity) {
        throw new Error(`Item en posición ${index} no tiene la estructura correcta`);
      }
      return {
        title: item.title.substring(0, 255),
        description: item.description ? item.description.substring(0, 255) : "Producto",
        picture_url: item.image || undefined,
        unit_price: parseFloat(item.price),
        quantity: parseInt(item.quantity, 10),
        currency_id: "ARS",
      };
    });

    const preference = new Preference(client);

    const FRONTEND_URL = process.env.FRONTEND_URL || "https://jamrock-club.vercel.app";

    const preferenceData = {
      items: validatedItems,
      back_urls: {
        // ✅ Directo al frontend — sin pasar por el backend
        // El backend en Vercel puede estar dormido cuando MP redirige
        success: `${FRONTEND_URL}/pago/aprobado`,
        failure: `${FRONTEND_URL}/pago/rechazado`,
        pending: `${FRONTEND_URL}/pago/pendiente`,
      },
      // ✅ auto_return solo para aprobados — MP redirige automáticamente
      auto_return: "approved",
      notification_url: process.env.NOTIFICATION_URL,
    };

    console.log("Creando preferencia con datos:", preferenceData);

    const response = await preference.create({ body: preferenceData });

    console.log("Respuesta de Mercado Pago:", response);

    if (!response.init_point) {
      throw new Error("No se recibió init_point de Mercado Pago");
    }

    return res.status(200).json({
      init_point: response.init_point,
      preference_id: response.id
    });

  } catch (error) {
    console.error("Error completo al procesar la solicitud:", error);

    let errorMessage = "Hubo un error al procesar la solicitud";
    if (error.message.includes("access_token")) {
      errorMessage = "Error de configuración: ACCESS_TOKEN inválido o faltante";
    } else if (error.message.includes("currency_id")) {
      errorMessage = "Error en la moneda, debe ser ARS";
    } else if (error.message.includes("unit_price")) {
      errorMessage = "Error en los precios de los productos";
    }

    return res.status(500).json({
      error: errorMessage,
      details: error.message,
      type: error.name
    });
  }
});

module.exports = Mercado_Pago;