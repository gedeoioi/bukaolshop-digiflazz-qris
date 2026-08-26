import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.apiKey',
      'req.body.api_key',
      'req.body.token',
      'req.body.secret',
      '*.password',
      '*.apiKey',
      '*.api_key',
      '*.botToken',
      '*.bot_token',
      '*.secret',
      '*.webhookSecret',
      '*.webhook_secret',
    ],
    remove: true,
  },
});
