import { Router } from 'express';
import { healthRoutes } from './modules/health/health.routes.js';

/**
 * Ponto único onde todos os módulos registram suas rotas.
 * Próximas etapas vão adicionar: auth, sessoes, alunos, fases, tentativas, ranking.
 */
export const routes = Router();

routes.use('/health', healthRoutes);
