import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/params.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { RelatoriosService } from './relatorios.service.js';

/** Etapa 9 — relatórios da turma (somente professor). */
export function relatoriosRoutes(ctx: Contexto) {
  const router = Router();
  const service = new RelatoriosService(ctx);
  router.use(autenticar, exigirPerfil('PROFESSOR'));

  // Visão geral: COUNT / AVG / MAX / MIN / SUM
  router.get('/turmas/:id/resumo', async (req, res) => {
    res.json(await service.resumo(lerId(req)));
  });

  // Estatísticas por fase (GROUP BY)
  router.get('/turmas/:id/fases', async (req, res) => {
    res.json(await service.desempenhoPorFase(lerId(req)));
  });

  // Boletim: pivot aluno × fase
  router.get('/turmas/:id/boletim', async (req, res) => {
    res.json(await service.boletim(lerId(req)));
  });

  // Desafios mais errados — ?limite=5 (padrão)
  router.get('/turmas/:id/desafios-mais-errados', async (req, res) => {
    res.json(await service.desafiosMaisErrados(lerId(req), req.query));
  });

  return router;
}