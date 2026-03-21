const server = require('./src/server');
const { startAbandonedCartCron } = require('./src/utils/abandonedCartCron.js');

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  // Arrancar cron de carritos abandonados
  startAbandonedCartCron();
});

// Manejo limpio de cierre
process.on('SIGTERM', () => {
  const { stopAbandonedCartCron } = require('./src/utils/abandonedCartCron.js');
  stopAbandonedCartCron();
  process.exit(0);
});