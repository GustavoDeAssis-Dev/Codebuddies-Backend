import { Router } from 'express';
import type { Contexto } from '../../shared/contexto.js';
import { lerId } from '../../shared/http/param.js';
import { autenticar, exigirPerfil } from '../../shared/middlewares/autenticar.js';
import { AlunosService } from '../alunos/alunos.service.js';
import { RankingService } from '../ranking/ranking.service.js';
import { criarSessaoSchema, filtroSessoesSchema } from './sessoes.schemas.js';
import { SessoesService } from './sessoes.service.js';

export function sessoesRoutes(ctx: Contexto) {
  const router = Router();
  const service = new SessoesService(ctx);
  const alunos = new AlunosService(ctx);
  const ranking = new RankingService(ctx);

  const soProfessor = [autenticar, exigirPerfil('PROFESSOR')];

  // ⚠️ '/aberta' precisa vir ANTES de '/:id', senão o Express acha que "aberta" é um id.

  // GET /api/sessoes/aberta — PÚBLICA: a tela inicial do aluno usa para mostrar
  // "Aguardando professor iniciar a aula" (CA01)
  router.get('/aberta', async (_req, res) => {
    res.json(await service.resumoAberta());
  });

  router.post('/', ...soProfessor, async (req, res) => {
    const { turmaId } = criarSessaoSchema.parse(req.body);
        res.status(201).json(await service.criar(turmaId, req.usuario!.id)); // professor que está logado
  });

  router.get('/', ...soProfessor, async (req, res) => {
    res.json(await service.listar(filtroSessoesSchema.parse(req.query)));
  });

  router.get('/:id', ...soProfessor, async (req, res) => {
    res.json(await service.buscar(lerId(req)));
  });

  // RF-D03 — abrir a aula (libera a entrada dos alunos)
  router.post('/:id/abrir', ...soProfessor, async (req, res) => {
    res.json(await service.abrir(lerId(req)));
  });

  // RF-D04 — encerrar a aula (bloqueia entradas e gera o ranking final)
  router.post('/:id/encerrar', ...soProfessor, async (req, res) => {
    res.json(await service.encerrar(lerId(req)));
  });

  // RF-D07 — alunos que participaram desta aula
  router.get('/:id/alunos', ...soProfessor, async (req, res) => {
    res.json(await alunos.listarDaSessao(lerId(req)));
  });

  // RF-P14 / RF-A05 — ranking: aluno OU professor, mas só depois de encerrada (RN08)
  router.get('/:id/ranking', autenticar, async (req, res) => {
    res.json(await ranking.obter(lerId(req)));
  });

  return router;
}