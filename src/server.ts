import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initTelegramBot } from './telegram/bot';
import { startScheduler } from './scheduler/cron';

const PORT = env.PORT;

async function main() {
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
  });

  await initTelegramBot();
  startScheduler();
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});
