import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { TentativasService } from '../src/modules/tentativas/tentativas.service.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import type { Contexto } from '../src/shared/contexto.js';

let ctx: Contexto;
let app: ReturnType<typeof createApp>;
let tokenProf: string;

const comToken = (token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) =>
    request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body: object) =>
    request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});
const prof = () => comToken(tokenProf);

beforeEach(async () => {
  ctx = { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
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
});

/** Abre uma aula e coloca um aluno nela. */
async function alunoNaAula() {
  const turma = await prof().post('/api/turmas', { nome: '1º ano A' });
  const sessao = await prof().post('/api/sessoes', { turmaId: turma.body.id });
  await prof().post(`/api/sessoes/${sessao.body.id}/abrir`);
  const entrada = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
  return {
    token: entrada.body.token as string,
    alunoId: entrada.body.aluno.id as number,
    sessaoId: sessao.body.id as number,
  };
}

describe('Níveis (professor)', () => {
  it('lista em ordem e cria no final quando não informa a ordem', async () => {
    const criado = await prof().post('/api/niveis', { titulo: 'Desafios finais' });
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({ ordem: 4, titulo: 'Desafios finais', descricao: null });

    const lista = await prof().get('/api/niveis');
    expect(lista.body.map((n: { ordem: number }) => n.ordem)).toEqual([1, 2, 3, 4]);
  });

  it('número repetido → 409 NIVEL_DUPLICADO', async () => {
    const res = await prof().post('/api/niveis', { ordem: 1, titulo: 'Outro' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NIVEL_DUPLICADO');
  });

  it('GET /:id traz as fases do nível', async () => {
    const res = await prof().get('/api/niveis/2');
    expect(res.body.fases.map((f: { titulo: string }) => f.titulo)).toEqual(['Vogais', 'Palavras curtas']);
  });

  it('não apaga nível com fases; apaga nível vazio (204)', async () => {
    expect((await prof().delete('/api/niveis/1')).body.error.code).toBe('NIVEL_COM_FASES');
    const vazio = await prof().post('/api/niveis', { titulo: 'Vazio' });
    expect((await prof().delete(`/api/niveis/${vazio.body.id}`)).status).toBe(204);
    expect((await prof().get(`/api/niveis/${vazio.body.id}`)).status).toBe(404);
  });

  it('valida campos (título vazio, ordem 0)', async () => {
    const res = await prof().post('/api/niveis', { ordem: 0, titulo: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
  });
});

describe('Fases (professor)', () => {
  it('lista todas na ordem do jogo', async () => {
    const res = await prof().get('/api/fases');
    expect(res.body).toHaveLength(6);
    expect(res.body[0]).toMatchObject({ titulo: 'Clique nos balões', nivel: { ordem: 1 } });
  });

  it('GET /:id traz o nível e os desafios com a resposta (professor pode ver)', async () => {
    const res = await prof().get('/api/fases/3');
    expect(res.body.nivel.titulo).toBe('Primeiras letras');
    expect(res.body.desafios).toHaveLength(3);
    expect(res.body.desafios[0]).toMatchObject({ ordem: 1, respostaCorreta: 'A' });
  });

  it('cria no final do nível e barra posição repetida', async () => {
    const nova = await prof().post('/api/fases', {
      nivelId: 1,
      titulo: 'Arraste o mouse',
      tipo: 'COMPUTACAO_BASICA',
    });
    expect(nova.status).toBe(201);
    expect(nova.body.ordem).toBe(3);

    const repetida = await prof().post('/api/fases', { nivelId: 1, ordem: 1, titulo: 'X', tipo: 'LOGICA' });
    expect(repetida.body.error.code).toBe('ORDEM_FASE_DUPLICADA');
  });

  it('tipo inválido → 400; nível inexistente → 404', async () => {
    expect((await prof().post('/api/fases', { nivelId: 1, titulo: 'X', tipo: 'JOGO' })).status).toBe(400);
    const semNivel = await prof().post('/api/fases', { nivelId: 99, titulo: 'X', tipo: 'LOGICA' });
    expect(semNivel.body.error.code).toBe('NIVEL_NAO_ENCONTRADO');
  });

  it('PATCH move a fase para outro nível', async () => {
    const res = await prof().patch('/api/fases/6', { nivelId: 2, ordem: 3 });
    expect(res.body).toMatchObject({ nivelId: 2, ordem: 3 });
    const nivel2 = await prof().get('/api/niveis/2');
    expect(nivel2.body.fases).toHaveLength(3);
  });

  it('não apaga fase com desafios; apaga depois de remover os desafios', async () => {
    expect((await prof().delete('/api/fases/6')).body.error.code).toBe('FASE_COM_DESAFIOS');
    const { body } = await prof().get('/api/fases/6');
    for (const d of body.desafios) await prof().delete(`/api/desafios/${d.id}`);
    expect((await prof().delete('/api/fases/6')).status).toBe(204);
  });

  it('não apaga fase que já foi jogada', async () => {
    const { alunoId } = await alunoNaAula();
    await new TentativasService(ctx).registrar(alunoId, {
      faseId: 1,
      tempoSegundos: 20,
      respostas: [
        { desafioId: 1, resposta: '3' },
        { desafioId: 2, resposta: 'AZUL' },
        { desafioId: 3, resposta: '2' },
      ],
    });
    expect((await prof().delete('/api/fases/1')).body.error.code).toBe('FASE_JA_JOGADA');
    const primeiro = (await prof().get('/api/fases/1')).body.desafios[0];
    expect((await prof().delete(`/api/desafios/${primeiro.id}`)).body.error.code).toBe('FASE_JA_JOGADA');
  });
});

describe('Desafios (professor)', () => {
  it('cria no final da fase com 100 pontos por padrão', async () => {
    const res = await prof().post('/api/fases/3/desafios', {
      enunciado: 'Digite a vogal que começa a palavra IGREJA',
      respostaCorreta: ' I ',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ faseId: 3, ordem: 4, pontos: 100, respostaCorreta: 'I' });
  });

  it('posição repetida → 409; fase inexistente → 404', async () => {
    const dup = await prof().post('/api/fases/3/desafios', { ordem: 1, enunciado: 'X', respostaCorreta: 'X' });
    expect(dup.body.error.code).toBe('ORDEM_DESAFIO_DUPLICADA');
    const semFase = await prof().post('/api/fases/99/desafios', { enunciado: 'X', respostaCorreta: 'X' });
    expect(semFase.body.error.code).toBe('FASE_NAO_ENCONTRADA');
  });

  it('PATCH corrige a resposta e os pontos', async () => {
    const res = await prof().patch('/api/desafios/1', { respostaCorreta: '4', pontos: 150 });
    expect(res.body).toMatchObject({ id: 1, respostaCorreta: '4', pontos: 150 });
  });

  it('PATCH vazio → 400', async () => {
    expect((await prof().patch('/api/desafios/1', {})).status).toBe(400);
  });
});

describe('Jogo (aluno)', () => {
  it('aluno não acessa o cadastro de conteúdo', async () => {
    const { token } = await alunoNaAula();
    expect((await comToken(token).get('/api/fases')).status).toBe(403);  
  });

   it('POST /api/jogo/fases/:id/respostas corrige e devolve as estrelas (sem revelar respostas)', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).post('/api/jogo/fases/1/respostas', {
      tempoSegundos: 30,
      respostas: [
        { desafioId: 1, resposta: '3' },
        { desafioId: 2, resposta: 'azul' },
        { desafioId: 3, resposta: '5' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      acertos: 2,
      erros: 1,
      percentual: 66,
      estrelas: 3,
      pontos: 200,
      aprovada: true,
      proximaFaseId: 2,
    });
    expect(JSON.stringify(res.body)).not.toContain('respostaCorreta');
  });

  it('POST de respostas sem a lista → 400 DADOS_INVALIDOS', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).post('/api/jogo/fases/1/respostas', { tempoSegundos: 30 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
  });

  it('GET /api/jogo/mapa mostra só a primeira fase liberada', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).get('/api/jogo/mapa');
    expect(res.status).toBe(200);
    expect(res.body.fases[0].status).toBe('LIBERADA');
    expect(res.body.fases[1].status).toBe('BLOQUEADA');
  });

  it('GET /api/jogo/fases/:id entrega os desafios SEM a resposta correta', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).get('/api/jogo/fases/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalDesafios: 3,
      pontosPossiveis: 300,
      fase: { titulo: 'Clique nos balões' },
    });
    expect(JSON.stringify(res.body)).not.toContain('respostaCorreta');
  });

  it('fase bloqueada → 403 FASE_BLOQUEADA', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).get('/api/jogo/fases/2');
    expect(res.body.error.code).toBe('FASE_BLOQUEADA');
  });

  it('fase sem desafios → 409 FASE_SEM_DESAFIOS', async () => {
    // Fase nova e vazia no começo do jogo: move o nível 1 para o fim e cria outro na posição 1
    await prof().patch('/api/niveis/1', { ordem: 10 });
    const novo = await prof().post('/api/niveis', { ordem: 1, titulo: 'Boas-vindas' });
    const vazia = await prof().post('/api/fases', { nivelId: novo.body.id, titulo: 'Vazia', tipo: 'LOGICA' });

    const { token } = await alunoNaAula();
    const res = await comToken(token).get(`/api/jogo/fases/${vazia.body.id}`);
    expect(res.body.error.code).toBe('FASE_SEM_DESAFIOS');
  });

  it('sem aula aberta → 403 SESSAO_FECHADA', async () => {
    const { token, sessaoId } = await alunoNaAula();
    await prof().post(`/api/sessoes/${sessaoId}/encerrar`);
    const res = await comToken(token).get('/api/jogo/fases/1');
    expect(res.body.error.code).toBe('SESSAO_FECHADA');
  });

    it('GET /api/jogo/conquistas: aluno novo começa com tudo bloqueado', async () => {
    const { token } = await alunoNaAula();
    const res = await comToken(token).get('/api/jogo/conquistas');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estrelasTotais: 0,
      pontosTotais: 0,
      fasesConcluidas: 0,
      totalFases: 6,
      totalConquistadas: 0,
    });
    expect(res.body.conquistas).toHaveLength(6);
  });

  it('acertar tudo na primeira fase dá "Primeira estrela" e "Perfeito!" (só uma vez)', async () => {
    const { token } = await alunoNaAula();
    const tudoCerto = {
      tempoSegundos: 20,
      respostas: [
        { desafioId: 1, resposta: '3' },
        { desafioId: 2, resposta: 'azul' },
        { desafioId: 3, resposta: '2' },
      ],
    };

    const res = await comToken(token).post('/api/jogo/fases/1/respostas', tudoCerto);
    expect(res.body.novasConquistas.map((c: { codigo: string }) => c.codigo)).toEqual([
      'PRIMEIRA_FASE',
      'PERFEITO',
    ]);

    const painel = await comToken(token).get('/api/jogo/conquistas');
    expect(painel.body).toMatchObject({
      estrelasTotais: 5,
      pontosTotais: 300,
      fasesConcluidas: 1,
      totalConquistadas: 2,
    });

    // Jogar de novo com o mesmo resultado não dá medalha repetida
    const deNovo = await comToken(token).post('/api/jogo/fases/1/respostas', tudoCerto);
    expect(deNovo.body.novasConquistas).toEqual([]);
  });

  it('professor vê as conquistas de um aluno', async () => {
    const { alunoId } = await alunoNaAula();
    const res = await prof().get(`/api/alunos/${alunoId}/conquistas`);
    expect(res.status).toBe(200);
    expect(res.body.conquistas).toHaveLength(6);
    expect((await prof().get('/api/alunos/999/conquistas')).status).toBe(404);
  });

    it('professor vê o mapa de fases de um aluno (GET /api/alunos/:id/mapa)', async () => {
    const { alunoId, token } = await alunoNaAula();
    const res = await prof().get(`/api/alunos/${alunoId}/mapa`);
    expect(res.status).toBe(200);
    expect(res.body.fases).toHaveLength(6);
    expect(res.body.fases[0].status).toBe('LIBERADA');

    expect((await prof().get('/api/alunos/999/mapa')).status).toBe(404);
    expect((await comToken(token).get(`/api/alunos/${alunoId}/mapa`)).status).toBe(403); // aluno não
  });
});

describe('Fases sem desafios (correção da integração com o front)', () => {
  it('GET /api/fases informa quantos desafios cada fase tem', async () => {
    const res = await prof().get('/api/fases');
    expect(res.body[0]).toMatchObject({ titulo: 'Clique nos balões', totalDesafios: 3 });
  });

  it('fase sem desafios não aparece no mapa do aluno e não trava as próximas', async () => {
    // Fase "em construção" no fim do nível 1 (entre "Encontre as teclas" e "Vogais")
    const vazia = await prof().post('/api/fases', { nivelId: 1, titulo: 'Em construção', tipo: 'LOGICA' });
    const lista = await prof().get('/api/fases');
    expect(lista.body.find((f: { id: number }) => f.id === vazia.body.id)).toMatchObject({ totalDesafios: 0 });

    const { token, alunoId } = await alunoNaAula();
    const mapa = await comToken(token).get('/api/jogo/mapa');
    expect(mapa.body.fases).toHaveLength(6); // a fase vazia não aparece
    expect(mapa.body.fases.map((f: { faseId: number }) => f.faseId)).not.toContain(vazia.body.id);

    // Conclui as 2 fases do nível 1: "Vogais" (nível 2) precisa ser liberada mesmo com a fase vazia no meio
    const tentativas = new TentativasService(ctx);
    await tentativas.registrar(alunoId, {
      faseId: 1,
      tempoSegundos: 10,
      respostas: [
        { desafioId: 1, resposta: '3' },
        { desafioId: 2, resposta: 'azul' },
        { desafioId: 3, resposta: '2' },
      ],
    });
    await tentativas.registrar(alunoId, {
      faseId: 2,
      tempoSegundos: 10,
      respostas: [
        { desafioId: 4, resposta: 'backspace' },
        { desafioId: 5, resposta: 'enter' },
        { desafioId: 6, resposta: 'espaco' },
      ],
    });
    const depois = await comToken(token).get('/api/jogo/mapa');
    expect(depois.body.fases[2]).toMatchObject({ titulo: 'Vogais', status: 'LIBERADA' });
    expect(depois.body.nivelAtual).toBe(2);
  });
});
