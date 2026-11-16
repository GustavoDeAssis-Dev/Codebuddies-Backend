import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import type { Contexto } from '../src/shared/contexto.js';
import { comTraducaoDeErros } from '../src/repositories/oracle/erros-oracle.js';
import { env } from '../src/config/env.js';

const EM_INGLES = /invalid input|expected|received|too (big|small)/i;

let app: ReturnType<typeof createApp>;
let token: string;

beforeAll(async () => {
  const ctx: Contexto = { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
  app = createApp(ctx);
  await new AuthService(ctx).cadastrarProfessor({ nome: 'Prof', email: 'prof@escola.com', senha: 'senha-123456' });
  const login = await request(app)
    .post('/api/auth/professor/login')
    .send({ email: 'prof@escola.com', senha: 'senha-123456' });
  token = login.body.token;
});

describe('Validação em português (Etapa 10)', () => {
  it('mensagens padrão do Zod saem em português', () => {
    const tipoErrado = z.string().safeParse(123);
    const curto = z.string().min(3).safeParse('a');
    expect(tipoErrado.error!.issues[0]!.message).not.toMatch(EM_INGLES);
    expect(curto.error!.issues[0]!.message).not.toMatch(EM_INGLES);
  });

  it('na API: número onde era texto → 400 em português', async () => {
    const res = await request(app).post('/api/turmas').set('Authorization', `Bearer ${token}`).send({ nome: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
    expect(JSON.stringify(res.body)).not.toMatch(EM_INGLES);
  });

  it('na API: tipo de fase inexistente → mensagem própria em português', async () => {
    const res = await request(app)
      .post('/api/fases')
      .set('Authorization', `Bearer ${token}`)
      .send({ nivelId: 1, titulo: 'X', tipo: 'JOGO' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('Tipo deve ser');
  });
  
  describe('Erros inesperados e limites (Etapa 10)', () => {
  /** App novo com professor logado — para poder "sabotar" um repositório só neste teste. */
  async function appComProfessor() {
    const ctx: Contexto = { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
    const appTeste = createApp(ctx);
    await new AuthService(ctx).cadastrarProfessor({ nome: 'Prof', email: 'p@escola.com', senha: 'senha-123456' });
    const login = await request(appTeste)
      .post('/api/auth/professor/login')
      .send({ email: 'p@escola.com', senha: 'senha-123456' });
    return { ctx, appTeste, tokenTeste: login.body.token as string };
  }

  it('toda resposta traz o cabeçalho X-Request-Id', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('body acima de 100 KB → 413 CONTEUDO_MUITO_GRANDE', async () => {
    const res = await request(app)
      .post('/api/turmas')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ nome: 'x'.repeat(200_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('CONTEUDO_MUITO_GRANDE');
  });

  it('JSON malformado → 400 JSON_INVALIDO', async () => {
    const res = await request(app)
      .post('/api/turmas')
      .set('Content-Type', 'application/json')
      .send('{ "nome": N }');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JSON_INVALIDO');
  });

  it('erro inesperado → 500 com requestId e SEM detalhes internos', async () => {
    const { ctx, appTeste, tokenTeste } = await appComProfessor();
    ctx.repos.turmas.listar = async () => {
      throw new Error('ORA-00942: SELECT * FROM TABELA_SECRETA');
    };

    const res = await request(appTeste).get('/api/turmas').set('Authorization', `Bearer ${tokenTeste}`);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('ERRO_INTERNO');
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
    expect(JSON.stringify(res.body)).not.toMatch(/SELECT|ORA-|SECRETA|stack/);
  });

  it('banco fora do ar → 503 BANCO_INDISPONIVEL', async () => {
    const { ctx, appTeste, tokenTeste } = await appComProfessor();
    ctx.repos.turmas = comTraducaoDeErros({
      ...ctx.repos.turmas,
      listar: async () => {
        throw Object.assign(new Error('ORA-12541: TNS:no listener'), { errorNum: 12541 });
      },
    });

    const res = await request(appTeste).get('/api/turmas').set('Authorization', `Bearer ${tokenTeste}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('BANCO_INDISPONIVEL');
  });

    it(
    'limite geral: passou do limite por minuto → 429 MUITAS_REQUISICOES',
    async () => {
      const appLimite = createApp({ repos: criarRepositoriosEmMemoria(), agora: () => new Date() });
      for (let i = 0; i < env.RATE_LIMIT_POR_MINUTO; i++) await request(appLimite).get('/api/health');

      const res = await request(appLimite).get('/api/health');
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('MUITAS_REQUISICOES');
    },
    20_000, // 300 requisições: dá mais tempo que o padrão de 5 s
  );
});
});