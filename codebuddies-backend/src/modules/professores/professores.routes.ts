import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/param.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { ProfessoresService } from './professores.service.js';

export function professoresRoutes(ctx: Contexto) {
  const router = Router();
  const service = new ProfessoresService(ctx);

  router.use(autenticar, exigirPerfil('PROFESSOR'));

  router.get('/', async (_req, res) => {
    res.json(await service.listar());
  });

  router.post('/', async (req, res) => {
    res.status(201).json(await service.cadastrar(req.body));
  });

  // PUT /api/professores/eu/senha — troca a senha de quem está logado
  router.put('/eu/senha', async (req, res) => {
    await service.trocarSenha(req.usuario!.id, req.body);
    res.status(204).end(); // 204 = deu certo, sem conteúdo para devolver
  });

  // PATCH /api/professores/:id  { "ativo": false }
  router.patch('/:id', async (req, res) => {
    res.json(await service.alterarAtivo(lerId(req), req.body, req.usuario!.id));
  });

  return router;
}