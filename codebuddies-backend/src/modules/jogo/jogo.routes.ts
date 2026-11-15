import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/params.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { JogoService } from './jogo.service.js';

/** Etapa 6 — rotas do ALUNO (o id do aluno vem do token, nunca da URL). */
export function jogoRoutes(ctx: Contexto) {
  const router = Router();
  const service = new JogoService(ctx);
  router.use(autenticar, exigirPerfil('ALUNO'));

  // GET /api/jogo/mapa — fases com status (BLOQUEADA / LIBERADA / CONCLUIDA) e estrelas
  router.get('/mapa', async (req, res) => {
    res.json(await service.mapa(req.usuario!.id));
  });

  // GET /api/jogo/fases/:id — desafios da fase, SEM as respostas
  router.get('/fases/:id', async (req, res) => {
    res.json(await service.abrirFase(req.usuario!.id, lerId(req)));
  });

  return router;
}