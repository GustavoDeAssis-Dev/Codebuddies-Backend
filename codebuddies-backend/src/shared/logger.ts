import { pino } from 'pino';
import { env } from '../config/env.js';

/** Logger estruturado (JSON em produção, colorido em desenvolvimento). */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
  }),
});
