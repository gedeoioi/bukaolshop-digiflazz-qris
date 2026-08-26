import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    telegram: env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured',
    bukaolshop: env.BUKAOLSHOP_API_URL ? 'configured' : 'not_configured',
    digiflazz: env.DIGIFLAZZ_USERNAME ? 'configured' : 'not_configured',
    payment: env.PAYMENT_PROVIDER ? 'configured' : 'not_configured',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;
