import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import type { Contexto } from './shared/contexto.js';

/**
 * Ponto único onde todos os módulos registram suas rotas.
 * Próximas etapas vão adicionar: sessoes, alunos, fases, tentativas, ranking.
 */
export function criarRotas(ctx: Contexto) {
  const routes = Router();

  routes.use('/health', healthRoutes);
  routes.use('/auth', authRoutes(ctx));

  return routes;
}