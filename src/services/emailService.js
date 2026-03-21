// services/emailService.js
const { sendReporteFacturacionEmail } = require('../utils/emailSender');

class EmailService {
  /**
   * Envía un reporte de facturación por email
   */
  static async enviarReporteFacturacion(reporte, periodo, asunto = null, destinatario = null) {
    try {
      console.log('📧 [EmailService] Iniciando envío de reporte...');
      
      // Usar el asunto proporcionado o generar uno por defecto
      const subject = asunto || `📊 Reporte de Facturación - ${periodo} - 219Meds`;
      
      // Agregar el período al reporte si no está presente
      const reporteCompleto = {
        ...reporte,
        periodo: reporte.periodo || periodo
      };

      console.log('📧 [EmailService] Datos del reporte:', {
        periodo: periodo,
        ventasTotales: reporte.ventasTotales,
        destinatario: destinatario
      });

      // Usar la función del emailSender
      const resultado = await sendReporteFacturacionEmail(reporteCompleto, destinatario);
      
      if (resultado.success) {
        console.log('✅ [EmailService] Reporte enviado exitosamente');
        return {
          success: true,
          message: 'Reporte enviado exitosamente por email',
          messageId: resultado.messageId
        };
      } else {
        console.error('❌ [EmailService] Error enviando reporte:', resultado.error);
        return {
          success: false,
          message: 'Error al enviar el reporte por email',
          error: resultado.error
        };
      }

    } catch (error) {
      console.error('❌ [EmailService] Error crítico:', error.message);
      return {
        success: false,
        message: 'Error interno del servidor al enviar el reporte',
        error: error.message
      };
    }
  }

  /**
   * Método de prueba para verificar que el servicio funciona
   */
  static async testEnvioEmail() {
    try {
      const testReporte = {
        periodo: "Test - " + new Date().toLocaleDateString('es-AR'),
        fechaGeneracion: new Date().toISOString(),
        ventasTotales: 1500.50,
        analisisTurnos: {
          total: 10,
          pagados: 8
        },
        analisisPedidos: {
          total: 15,
          entregados: 12
        }
      };

      return await this.enviarReporteFacturacion(
        testReporte, 
        testReporte.periodo, 
        "Test de Email Service - 219Meds"
      );
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EmailService;