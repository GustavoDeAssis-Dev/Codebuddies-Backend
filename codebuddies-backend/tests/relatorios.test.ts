import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import type { Contexto } from '../src/shared/contexto.js';

let app: ReturnType<typeof createApp>;
let tokenProf: string;
let turmaId: number;

const prof = (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokenProf}`);

/** Aluno entra na aula aberta e envia respostas da fase 1 (respostas certas: '3', 'AZUL', '2'). */
async function alunoJoga(nome: string, jogadas: { respostas: string[]; tempo: number }[]) {
  const entrada = await request(app).post('/api/auth/aluno/entrar').send({ nome, idade: 6 });
  for (const jogada of jogadas) {
    await request(app)
      .post('/api/jogo/fases/1/respostas')
      .set('Authorization', `Bearer ${entrada.body.token}`)
      .send({
        tempoSegundos: jogada.tempo,
        respostas: jogada.respostas.map((resposta, i) => ({ desafioId: i + 1, resposta })),
      });
  }
  return entrada.body.aluno.id as number;
}

/**
 * Cenário (fase 1 tem 3 desafios, 100 pontos cada):
 *  - Ana: 3/3 certas → 100%, 5★, 300 pts, 20s
 *  - Bia: 1/3 → 33%, 1★, 100 pts, 40s   e depois   2/3 → 66%, 3★, 200 pts, 30s
 */
beforeEach(async () => {
  const ctx: Contexto = { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
  app = createApp(ctx);
  await new AuthService(ctx).cadastrarProfessor({
    nome: 'Diomara',
    email: 'prof@escola.com',
    senha: 'senha-123456',
  });
  const login = await request(app)
    .post('/api/auth/professor/login')
    .send({ email: 'prof@escola.com', senha: 'senha-123456' });
  tokenProf = login.body.token;

  const comToken = (url: string, body?: object) =>
    request(app).post(url).set('Authorization', `Bearer ${tokenProf}`).send(body);
  turmaId = (await comToken('/api/turmas', { nome: '1º ano A' })).body.id;
  const sessao = await comToken('/api/sessoes', { turmaId });
  await comToken(`/api/sessoes/${sessao.body.id}/abrir`);

  await alunoJoga('Ana', [{ respostas: ['3', 'azul', '2'], tempo: 20 }]);
  await alunoJoga('Bia', [
    { respostas: ['3', 'x', 'x'], tempo: 40 },
    { respostas: ['3', 'azul', 'x'], tempo: 30 },
  ]);
});

describe('Relatórios do professor (Etapa 9)', () => {
  it('resumo: COUNT, AVG, MAX, MIN e SUM das tentativas da turma', async () => {
    const res = await prof(`/api/relatorios/turmas/${turmaId}/resumo`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      turma: { id: turmaId, nome: '1º ano A' },
      totalAlunos: 2,
      alunosAtivos: 2,
      totalAulas: 1,
      aulasEncerradas: 0,
      totalTentativas: 3, // COUNT
      alunosQueJogaram: 2, // COUNT DISTINCT
      mediaEstrelas: 3, // AVG (5 + 1 + 3) / 3
      mediaPercentual: 66.3, // AVG (100 + 33 + 66) / 3
      maiorPercentual: 100, // MAX
      menorPercentual: 33, // MIN
      pontosTotais: 600, // SUM
      tempoMedioSegundos: 30, // AVG
      taxaAprovacao: 67, // 2 de 3 tentativas com 3+ estrelas
    });
  });

  it('turma sem jogadas: médias null (não zero) e pontos 0', async () => {
    const vazia = await request(app)
      .post('/api/turmas')
      .set('Authorization', `Bearer ${tokenProf}`)
      .send({ nome: 'Turma vazia' });
    const res = await prof(`/api/relatorios/turmas/${vazia.body.id}/resumo`);
    expect(res.body).toMatchObject({
      totalTentativas: 0,
      mediaEstrelas: null,
      pontosTotais: 0,
      taxaAprovacao: null,
    });
  });

  it('por fase (GROUP BY): todas as fases, inclusive as não jogadas', async () => {
    const res = await prof(`/api/relatorios/turmas/${turmaId}/fases`);
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({
      faseId: 1,
      titulo: 'Clique nos balões',
      totalTentativas: 3,
      alunosQueJogaram: 2,
      mediaEstrelas: 3,
    });
    expect(res.body[1]).toMatchObject({ faseId: 2, totalTentativas: 0, mediaEstrelas: null });
  });

  it('boletim (PIVOT): alunos × fases com as melhores estrelas', async () => {
    const res = await prof(`/api/relatorios/turmas/${turmaId}/boletim`);
    expect(res.body.fases).toHaveLength(6);
    expect(res.body.linhas).toEqual([
      {
        alunoId: expect.any(Number),
        nome: 'Ana',
        status: 'ATIVO',
        estrelas: [5, null, null, null, null, null],
        totalEstrelas: 5,
        fasesConcluidas: 1,
      },
      {
        alunoId: expect.any(Number),
        nome: 'Bia',
        status: 'ATIVO',
        estrelas: [3, null, null, null, null, null], // vale a MELHOR tentativa
        totalEstrelas: 3,
        fasesConcluidas: 1,
      },
    ]);
    expect(res.body.mediaPorFase).toEqual([4, null, null, null, null, null]);
  });

  it('desafios mais errados: ordenados pela taxa de erro, com limite', async () => {
    const res = await prof(`/api/relatorios/turmas/${turmaId}/desafios-mais-errados`);
    expect(res.body.map((d: { desafioId: number; erros: number; taxaErro: number }) => [
      d.desafioId,
      d.erros,
      d.taxaErro,
    ])).toEqual([
      [3, 2, 67], // "Quantos balões estouraram?" — errado 2 de 3 vezes
      [2, 1, 33],
    ]); // o desafio 1 ninguém errou → não aparece
    expect(res.body[0]).toMatchObject({ faseTitulo: 'Clique nos balões', respostaCorreta: '2' });

    const limitado = await prof(`/api/relatorios/turmas/${turmaId}/desafios-mais-errados?limite=1`);
    expect(limitado.body).toHaveLength(1);
  });

  it('limite inválido → 400; turma inexistente → 404', async () => {
    const limite = await prof(`/api/relatorios/turmas/${turmaId}/desafios-mais-errados?limite=0`);
    expect(limite.status).toBe(400);
    expect((await prof('/api/relatorios/turmas/999/resumo')).body.error.code).toBe('TURMA_NAO_ENCONTRADA');
  });

  it('aluno não acessa relatórios → 403', async () => {
    const aluno = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Caio', idade: 7 });
    const res = await request(app)
      .get(`/api/relatorios/turmas/${turmaId}/resumo`)
      .set('Authorization', `Bearer ${aluno.body.token}`);
    expect(res.status).toBe(403);
  });
});