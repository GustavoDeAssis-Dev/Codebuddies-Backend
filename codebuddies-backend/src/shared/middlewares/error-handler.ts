import type { NextFunction, Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { Erros } from '../errors/erros.js';
import { logger } from '../logger.js';

/**
 * Erros que o próprio Express gera ao ler o corpo (body-parser) trazem um `type`:
 *   'entity.too.large'   → corpo maior que o limite do express.json (app.ts)
 *   'entity.parse.failed' → JSON malformado
 * Aqui eles viram erros do nosso catálogo, para sair no formato padrão.
 */
function paraErroDoCatalogo(err: unknown): unknown {
  if (typeof err === 'object' && err !== null && 'type' in err) {
    if (err.type === 'entity.too.large') return Erros.conteudoMuitoGrande();
    if (err.type === 'entity.parse.failed') return Erros.jsonInvalido();
  }
  if (err instanceof SyntaxError && 'body' in err) return Erros.jsonInvalido();
  return err;
}

/**
 * Middleware central de erros. Todo erro lançado em qualquer rota cai aqui
 * (no Express 5, inclusive erros de funções async — sem precisar de try/catch).
 *
 * Formato padrão de resposta de erro:
 *   { "error": { "code": "...", "message": "...", "details"?: ..., "requestId"?: ... } }
 *
 * Regra de ouro (Etapa 10): erro INESPERADO nunca mostra detalhes internos (stack, SQL,
 * mensagem do Oracle) para o cliente. O detalhe vai só para o log, junto com o requestId.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const erro = paraErroDoCatalogo(err);
  const requestId = String(req.id);

  if (erro instanceof AppError) {
    // 503 (banco fora do ar) é problema de infraestrutura: registra para o responsável ver
    if (erro.statusCode >= 500) logger.warn({ err, requestId }, erro.message);
    return res.status(erro.statusCode).json({
      error: { code: erro.code, message: erro.message, details: erro.details },
    });
  }

  if (erro instanceof ZodError) {
    return res.status(400).json({
      error: { code: 'DADOS_INVALIDOS', message: 'Dados inválidos.', details: z.flattenError(erro) },
    });
  }

  // Qualquer outra coisa é um erro que não previmos: detalhe só no log, nunca na resposta
  logger.error({ err, requestId }, 'Erro inesperado');
  return res.status(500).json({
    error: {
      code: 'ERRO_INTERNO',
      message: 'Ops! Algo deu errado no servidor. Se continuar, avise o professor.',
      requestId,
    },
  });
}