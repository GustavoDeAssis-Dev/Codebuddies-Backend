import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { criarRotas } from './routes.js';
import { criarContexto, type Contexto } from './shared/contexto.js';
import { logger } from './shared/logger.js';
import { errorHandler } from './shared/middlewares/error-handler.js';
import { notFound } from './shared/middlewares/not-found.js';

/**
 * Monta a aplicação Express (sem abrir porta).
 * Separado do server.ts para que os testes possam usar o app direto com Supertest.
 */
export function createApp(ctx: Contexto = criarContexto()) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api', criarRotas(ctx));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
