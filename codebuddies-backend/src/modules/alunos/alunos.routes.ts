import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/param.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { AlunosService } from './alunos.service.js';

/** Gestão de alunos pelo professor (o aluno entra por /api/auth/aluno/entrar). */
export function alunosRoutes(ctx: Contexto) {
  const router = Router();
  const service = new AlunosService(ctx);

  router.use(autenticar, exigirPerfil('PROFESSOR'));

  router.get('/:id', async (req, res) => {
    res.json(await service.buscar(lerId(req)));
  });

  // Corrigir nome / idade / personagem
  router.patch('/:id', async (req, res) => {
    res.json(await service.atualizar(lerId(req), req.body));
  });

  // RF-D08 / RN10 — desativar e reativar (os dados nunca são apagados)
  router.post('/:id/desativar', async (req, res) => {
    res.json(await service.desativar(lerId(req)));
  });

  router.post('/:id/reativar', async (req, res) => {
    res.json(await service.reativar(lerId(req)));
  });

  return router;
}