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
import { randomUUID } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { Erros } from './shared/errors/erros.js';

/**
 * Monta a aplicação Express (sem abrir porta).
 * Separado do server.ts para que os testes possam usar o app direto com Supertest.
 */
export function createApp(ctx: Contexto = criarContexto()) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
   app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      exposedHeaders: ['X-Request-Id'], // deixa o Angular ler o id da requisição
    }),
  );
  // Etapa 10: cada requisição ganha um id único, que aparece no log e no cabeçalho X-Request-Id.
  // Vem ANTES do express.json para que até os erros de corpo (413, JSON inválido) tenham id.
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
    }),
  );
  // Etapa 10: limite geral por computador (o login continua com o seu limite próprio de 5/min).
  // Fica antes do express.json: quem passou do limite é barrado sem nem ler o corpo.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: env.RATE_LIMIT_POR_MINUTO,
      standardHeaders: 'draft-8', // cabeçalho RateLimit: quantas requisições ainda restam
      legacyHeaders: false,
      handler: (_req, _res, next) => next(Erros.muitasRequisicoes()), // sai no formato padrão
    }),
  );
  app.use(express.json({ limit: '100kb' })); // acima disso → 413 CONTEUDO_MUITO_GRANDE

  app.use('/api', criarRotas(ctx));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
