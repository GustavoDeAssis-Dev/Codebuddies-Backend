import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';   
import { SessoesService } from '../src/modules/sessoes/sessoes.service.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import { gerarToken } from '../src/shared/auth/token.js';
import type { Contexto } from '../src/shared/contexto.js';
import { autenticar, exigirPerfil } from '../src/shared/middlewares/autenticar.js';
import { errorHandler } from '../src/shared/middlewares/error-handler.js';

let ctx: Contexto;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  ctx = { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
  app = createApp(ctx);
  await new AuthService(ctx).cadastrarProfessor({
    nome: 'Prof. Diomara',
    email: 'prof@escola.com',
    senha: 'senha-segura-123',
  });
});

async function abrirAula() {
  const turma = await ctx.repos.turmas.criar({ nome: '2º ano B', criadaEm: new Date() });
  const sessoes = new SessoesService(ctx);
  const sessao = await sessoes.criar(turma.id);
  await sessoes.abrir(sessao.id);
  return sessao;
}

describe('Login do professor (RF-D01)', () => {
  it('senha correta → token de PROFESSOR, sem expor o hash', async () => {
    const res = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'PROF@escola.com ', senha: 'senha-segura-123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.professor.nome).toBe('Prof. Diomara');
    expect(res.body.professor.senhaHash).toBeUndefined();
  });

  it('senha errada e e-mail inexistente dão o MESMO erro', async () => {
    const errada = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'prof@escola.com', senha: 'errada' });
    const inexistente = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'ninguem@escola.com', senha: 'errada' });

    expect(errada.status).toBe(401);
    expect(errada.body.error.code).toBe('CREDENCIAIS_INVALIDAS');
    expect(inexistente.body).toEqual(errada.body);
  });

  it('bloqueia depois de 5 tentativas em 1 minuto', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/professor/login').send({ email: 'prof@escola.com', senha: 'x' });
    }
    const res = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'prof@escola.com', senha: 'senha-segura-123' });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('MUITAS_TENTATIVAS');
  });

  it('senha nunca é guardada pura', async () => {
    const professor = await ctx.repos.professores.buscarPorEmail('prof@escola.com');
    expect(professor!.senhaHash).not.toContain('senha-segura-123');
    expect(professor!.senhaHash).toMatch(/^\$2[aby]\$10\$/); // formato bcrypt
  });
});

describe('Entrada do aluno com token', () => {
  it('sem aula aberta → SESSAO_FECHADA', async () => {
    const res = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SESSAO_FECHADA');
  });

  it('com aula aberta → 201 na primeira vez, 200 ao voltar; token de ALUNO', async () => {
    const sessao = await abrirAula();
    const primeira = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
    const segunda = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'ana', idade: 6 });

    expect(primeira.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.body.aluno.id).toBe(primeira.body.aluno.id);

    const eu = await request(app).get('/api/auth/eu').set('Authorization', `Bearer ${primeira.body.token}`);
    expect(eu.body).toEqual({ perfil: 'ALUNO', id: primeira.body.aluno.id, sessaoId: sessao.id });
  });
});

describe('Middleware autenticar', () => {
  it('sem token → 401 NAO_AUTENTICADO', async () => {
    const res = await request(app).get('/api/auth/eu');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('NAO_AUTENTICADO');
  });

  it('token alterado ou assinado com outra chave → 401 TOKEN_INVALIDO', async () => {
    const falso = jwt.sign({ sub: '1', perfil: 'PROFESSOR' }, 'chave-de-um-hacker-com-32-caracteres!!');
    const res = await request(app).get('/api/auth/eu').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it('token expirado → 401 TOKEN_INVALIDO', async () => {
    const expirado = jwt.sign({ sub: '1', perfil: 'PROFESSOR' }, process.env.JWT_SECRET!, { expiresIn: -10 });
    const res = await request(app).get('/api/auth/eu').set('Authorization', `Bearer ${expirado}`);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it('professor logado consegue ver os próprios dados', async () => {
    const login = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'prof@escola.com', senha: 'senha-segura-123' });
    const res = await request(app).get('/api/auth/eu').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.body.perfil).toBe('PROFESSOR');
    expect(res.body.professor.email).toBe('prof@escola.com');
  });
});

describe('Middleware exigirPerfil (autorização)', () => {
  // Mini app só para testar a "portaria" de professor
  const appTeste = express();
  appTeste.post('/so-professor', autenticar, exigirPerfil('PROFESSOR'), (_req, res) => {
    res.json({ ok: true });
  });
  appTeste.use(errorHandler);

  it('aluno tentando ação de professor → 403 SEM_PERMISSAO', async () => {
    const token = gerarToken({ perfil: 'ALUNO', id: 1, sessaoId: 1 });
    const res = await request(appTeste).post('/so-professor').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SEM_PERMISSAO');
  });

  it('professor passa', async () => {
    const token = gerarToken({ perfil: 'PROFESSOR', id: 1 });
    const res = await request(appTeste).post('/so-professor').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});