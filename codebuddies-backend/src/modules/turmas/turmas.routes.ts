import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/param.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { AlunosService } from '../alunos/alunos.service.js';
import { TurmasService } from './turmas.service.js';

export function turmasRoutes(ctx: Contexto) {
  const router = Router();
  const service = new TurmasService(ctx);
  const alunos = new AlunosService(ctx);

  // Todas as rotas de turma são só para professor
  router.use(autenticar, exigirPerfil('PROFESSOR'));

  router.post('/', async (req, res) => {
    res.status(201).json(await service.criar(req.body));
  });

  router.get('/', async (_req, res) => {
    res.json(await service.listar());
  });

  router.get('/:id', async (req, res) => {
    res.json(await service.buscar(lerId(req)));
  });

  router.patch('/:id', async (req, res) => {
    res.json(await service.atualizar(lerId(req), req.body));
  });

  // GET /api/turmas/:id/alunos — todos os alunos da turma (ativos e desativados)
  router.get('/:id/alunos', async (req, res) => {
    res.json(await alunos.listarDaTurma(lerId(req)));
  });

  return router;
}