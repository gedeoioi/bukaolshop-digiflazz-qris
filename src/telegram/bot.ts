import { Telegraf, Context } from 'telegraf';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { registerCommands } from './commands';
import { setTelegramBot } from './notifications';

let bot: Telegraf | null = null;

export function getBot(): Telegraf | null {
  return bot;
}

export async function initTelegramBot(): Promise<Telegraf | null> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram bot token not configured, skipping bot initialization');
    return null;
  }

  bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  const adminIds = env.TELEGRAM_ADMIN_IDS
    ? env.TELEGRAM_ADMIN_IDS.split(',').map((id) => id.trim()).filter(Boolean)
    : [];

  bot.use(async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.from?.id.toString();
    if (userId && adminIds.length > 0 && !adminIds.includes(userId)) {
      logger.warn({ userId }, 'Unauthorized Telegram user');
      return;
    }
    return next();
  });

  registerCommands(bot);
  setTelegramBot(bot, adminIds);

  try {
    await bot.launch();
    logger.info('Telegram bot started');
    return bot;
  } catch (err) {
    logger.error({ err }, 'Failed to start Telegram bot');
    return null;
  }
}

export function stopTelegramBot(): void {
  if (bot) {
    bot.stop('SIGTERM');
    logger.info('Telegram bot stopped');
  }
}
