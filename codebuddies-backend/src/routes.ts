import { Router } from 'express';
import { alunosRoutes } from './modules/alunos/alunos.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { professoresRoutes } from './modules/professores/professores.routes.js';
import { sessoesRoutes } from './modules/sessoes/sessoes.routes.js';
import { turmasRoutes } from './modules/turmas/turmas.routes.js';
import type { Contexto } from './shared/contexto.js';
import { desafiosRoutes, fasesRoutes, niveisRoutes } from './modules/conteudo/conteudo.routes.js';
import { jogoRoutes } from './modules/jogo/jogo.routes.js';

/**
 * Ponto único onde todos os módulos registram suas rotas.
  * Próximas etapas vão adicionar: respostas/tentativas (7), recompensas (8), relatórios (9).
 */
export function criarRotas(ctx: Contexto) {
  const routes = Router();

  routes.use('/health', healthRoutes);
  routes.use('/auth', authRoutes(ctx));
  routes.use('/professores', professoresRoutes(ctx));
  routes.use('/turmas', turmasRoutes(ctx));
  routes.use('/sessoes', sessoesRoutes(ctx));
  routes.use('/alunos', alunosRoutes(ctx));
  
  // Etapa 6 — conteúdo (professor)
  routes.use('/niveis', niveisRoutes(ctx));
  routes.use('/fases', fasesRoutes(ctx));
  routes.use('/desafios', desafiosRoutes(ctx));

  routes.use('/jogo', jogoRoutes(ctx));
  
  return routes;
}