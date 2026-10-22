import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger.js';

/**
 * Middleware central de erros. Todo erro lançado em qualquer rota cai aqui
 * (no Express 5, inclusive erros de funções async — sem precisar de try/catch).
 *
 * Formato padrão de resposta de erro:
 *   { "error": { "code": "...", "message": "...", "details"?: ... } }
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'DADOS_INVALIDOS', message: 'Dados inválidos.', details: z.flattenError(err) },
    });
  }

  // JSON malformado no corpo da requisição
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: { code: 'JSON_INVALIDO', message: 'JSON malformado.' } });
  }

  logger.error({ err }, 'Erro inesperado');
  return res.status(500).json({
    error: { code: 'ERRO_INTERNO', message: 'Ops! Algo deu errado no servidor.' },
  });
}
