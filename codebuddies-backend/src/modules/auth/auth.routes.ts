import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Contexto } from '../../shared/contexto.js';
import { autenticar } from '../../shared/middlewares/autenticar.js';
import { AuthService } from './auth.service.js';

export function authRoutes(ctx: Contexto) {
  const router = Router();
  const service = new AuthService(ctx);

  // No máximo 5 tentativas de login do professor por minuto, por computador (IP).
  const limitarLogin = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: { code: 'MUITAS_TENTATIVAS', message: 'Muitas tentativas. Aguarde 1 minuto.' },
      });
    },
  });

  // POST /api/auth/professor/login  { email, senha }
  router.post('/professor/login', limitarLogin, async (req, res) => {
    res.json(await service.loginProfessor(req.body));
  });

  // POST /api/auth/aluno/entrar  { nome, idade, personagem? }
  router.post('/aluno/entrar', async (req, res) => {
    const resultado = await service.entrarAluno(req.body);
    res.status(resultado.novo ? 201 : 200).json(resultado);
  });

  // GET /api/auth/eu  (precisa do token) — "quem sou eu?"
  router.get('/eu', autenticar, async (req, res) => {
    const usuario = req.usuario!;
    if (usuario.perfil === 'PROFESSOR') {
      res.json({ perfil: 'PROFESSOR', professor: await service.buscarProfessor(usuario.id) });
    } else {
      res.json(usuario);
    }
  });

  return router;
}