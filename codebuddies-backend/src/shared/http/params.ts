import type { Request } from 'express';
import { z } from 'zod';

const idSchema = z.coerce.number({ error: 'ID inválido' }).int('ID inválido').positive('ID inválido');

/**
 * Lê um ID da URL. Ex.: em GET /turmas/7 → lerId(req) devolve 7.
 * "abc", "-1" ou "2.5" viram erro 400 DADOS_INVALIDOS (pelo errorHandler).
 */
export function lerId(req: Request, nome = 'id'): number {
  return idSchema.parse(req.params[nome]);
}