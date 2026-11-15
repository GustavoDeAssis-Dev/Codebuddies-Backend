import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/params.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { ConteudoService } from './conteudo.service.js';

/**
 * Etapa 6 — rotas de gerenciamento do conteúdo (somente PROFESSOR).
 * São três "routers", um para cada recurso: /api/niveis, /api/fases e /api/desafios.
 */

export function niveisRoutes(ctx: Contexto) {
  const router = Router();
  const service = new ConteudoService(ctx);
  router.use(autenticar, exigirPerfil('PROFESSOR'));

  router.get('/', async (_req, res) => {
    res.json(await service.listarNiveis());
  });

  // Nível + as fases dele
  router.get('/:id', async (req, res) => {
    res.json(await service.buscarNivel(lerId(req)));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.criarNivel(req.body));
  });

  router.patch('/:id', async (req, res) => {
    res.json(await service.atualizarNivel(lerId(req), req.body));
  });

  router.delete('/:id', async (req, res) => {
    await service.removerNivel(lerId(req));
    res.status(204).end();
  });

  return router;
}

export function fasesRoutes(ctx: Contexto) {
  const router = Router();
  const service = new ConteudoService(ctx);
  router.use(autenticar, exigirPerfil('PROFESSOR'));

  // Todas as fases, na ordem do jogo
  router.get('/', async (_req, res) => {
    res.json(await service.listarFases());
  });

  // Fase + nível + desafios (com a resposta correta — só o professor vê)
  router.get('/:id', async (req, res) => {
    res.json(await service.buscarFase(lerId(req)));
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.criarFase(req.body));
  });

  router.patch('/:id', async (req, res) => {
    res.json(await service.atualizarFase(lerId(req), req.body));
  });

  router.delete('/:id', async (req, res) => {
    await service.removerFase(lerId(req));
    res.status(204).end();
  });

  // Desafios pertencem a uma fase: criar = POST /api/fases/:id/desafios
  router.post('/:id/desafios', async (req, res) => {
    res.status(201).json(await service.criarDesafio(lerId(req), req.body));
  });

  return router;
}

export function desafiosRoutes(ctx: Contexto) {
  const router = Router();
  const service = new ConteudoService(ctx);
  router.use(autenticar, exigirPerfil('PROFESSOR'));

  router.get('/:id', async (req, res) => {
    res.json(await service.buscarDesafio(lerId(req)));
  });

  router.patch('/:id', async (req, res) => {
    res.json(await service.atualizarDesafio(lerId(req), req.body));
  });

  router.delete('/:id', async (req, res) => {
    await service.removerDesafio(lerId(req));
    res.status(204).end();
  });

  return router;
}