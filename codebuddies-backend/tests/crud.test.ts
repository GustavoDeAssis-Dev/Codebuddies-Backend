import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import type { Contexto } from '../src/shared/contexto.js';

let app: ReturnType<typeof createApp>;
let tokenProf: string;

/** Atalho: requisição já com o token do professor. */
const prof = {
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${tokenProf}`),
  post: (url: string, body?: object) =>
    request(app).post(url).set('Authorization', `Bearer ${tokenProf}`).send(body),
  patch: (url: string, body: object) =>
    request(app).patch(url).set('Authorization', `Bearer ${tokenProf}`).send(body),
  put: (url: string, body: object) =>
    request(app).put(url).set('Authorization', `Bearer ${tokenProf}`).send(body),
};

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
});

/** Cria turma + aula aberta e devolve os ids. */
async function aulaAberta() {
  const turma = await prof.post('/api/turmas', { nome: '2º ano B' });
  const sessao = await prof.post('/api/sessoes', { turmaId: turma.body.id });
  await prof.post(`/api/sessoes/${sessao.body.id}/abrir`);
  return { turmaId: turma.body.id as number, sessaoId: sessao.body.id as number };
}

describe('Proteção das rotas', () => {
  it('sem token → 401', async () => {
    const res = await request(app).get('/api/turmas');
    expect(res.status).toBe(401);
  });

  it('aluno não acessa rotas de professor → 403', async () => {
    await aulaAberta();
    const aluno = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
    const res = await request(app).get('/api/turmas').set('Authorization', `Bearer ${aluno.body.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SEM_PERMISSAO');
  });

  it('id inválido na URL → 400', async () => {
    const res = await prof.get('/api/turmas/abc');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DADOS_INVALIDOS');
  });
});

describe('Turmas', () => {
  it('cria, lista, busca e renomeia', async () => {
    const criada = await prof.post('/api/turmas', { nome: '  3º ano A ' });
    expect(criada.status).toBe(201);
    expect(criada.body).toMatchObject({ nome: '3º ano A', ativa: true });

    await prof.post('/api/turmas', { nome: '1º ano C' });
    const lista = await prof.get('/api/turmas');
    expect(lista.body.map((t: { nome: string }) => t.nome)).toEqual(['1º ano C', '3º ano A']);

    const editada = await prof.patch(`/api/turmas/${criada.body.id}`, { nome: '3º ano B' });
    expect(editada.body.nome).toBe('3º ano B');
    expect((await prof.get(`/api/turmas/${criada.body.id}`)).body.nome).toBe('3º ano B');
  });

  it('nome vazio → 400; turma inexistente → 404', async () => {
    expect((await prof.post('/api/turmas', { nome: '' })).status).toBe(400);
    expect((await prof.get('/api/turmas/999')).status).toBe(404);
  });

  it('não desativa turma com aula aberta; turma desativada não cria aula', async () => {
    const { turmaId } = await aulaAberta();
    const res = await prof.patch(`/api/turmas/${turmaId}`, { ativa: false });
    expect(res.body.error.code).toBe('TURMA_COM_AULA_ABERTA');

    const outra = await prof.post('/api/turmas', { nome: 'Outra' });
    await prof.patch(`/api/turmas/${outra.body.id}`, { ativa: false });
    const aula = await prof.post('/api/sessoes', { turmaId: outra.body.id });
    expect(aula.body.error.code).toBe('TURMA_NAO_ENCONTRADA');
  });
});

describe('Sessões (aulas)', () => {
  it('GET /sessoes/aberta é pública e mostra se há aula (CA01)', async () => {
    const antes = await request(app).get('/api/sessoes/aberta');
    expect(antes.body).toEqual({ aberta: false });

    const { sessaoId } = await aulaAberta();
    const depois = await request(app).get('/api/sessoes/aberta');
    expect(depois.body).toMatchObject({ aberta: true, sessao: { id: sessaoId, turmaNome: '2º ano B' } });
  });

  it('ciclo completo: criar → abrir → alunos entram → encerrar → ranking', async () => {
    const { sessaoId } = await aulaAberta();
    const ana = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
    await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Bia', idade: 7 });

    // RF-D07 — lista de alunos da aula
    const alunos = await prof.get(`/api/sessoes/${sessaoId}/alunos`);
    expect(alunos.body.map((a: { nome: string }) => a.nome)).toEqual(['Ana', 'Bia']);

    // RN08 — ranking escondido com a aula aberta (inclusive para o aluno)
    const cedo = await request(app)
      .get(`/api/sessoes/${sessaoId}/ranking`)
      .set('Authorization', `Bearer ${ana.body.token}`);
    expect(cedo.body.error.code).toBe('RANKING_INDISPONIVEL');

    const encerrada = await prof.post(`/api/sessoes/${sessaoId}/encerrar`);
    expect(encerrada.body.sessao.status).toBe('ENCERRADA');
    expect(encerrada.body.ranking.itens).toHaveLength(2);

    const ranking = await request(app)
      .get(`/api/sessoes/${sessaoId}/ranking`)
      .set('Authorization', `Bearer ${ana.body.token}`);
    expect(ranking.status).toBe(200);
  });

  it('lista com filtros', async () => {
    const { turmaId, sessaoId } = await aulaAberta();
    await prof.post(`/api/sessoes/${sessaoId}/encerrar`);
    await prof.post('/api/sessoes', { turmaId });

    expect((await prof.get('/api/sessoes')).body).toHaveLength(2);
    const encerradas = await prof.get('/api/sessoes?status=ENCERRADA');
    expect(encerradas.body.map((s: { id: number }) => s.id)).toEqual([sessaoId]);
    expect((await prof.get('/api/sessoes?status=QUALQUER')).status).toBe(400);
  });

  it('regras da Etapa 2 continuam valendo pela API (RN01)', async () => {
    const { turmaId } = await aulaAberta();
    const outra = await prof.post('/api/sessoes', { turmaId });
    const res = await prof.post(`/api/sessoes/${outra.body.id}/abrir`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('OUTRA_SESSAO_ABERTA');
  });
});

describe('Alunos', () => {
  it('professor corrige a idade (aniversário) e o aluno continua sendo reconhecido', async () => {
    await aulaAberta();
    const entrada = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'João', idade: 6 });
    const id = entrada.body.aluno.id;

    const editado = await prof.patch(`/api/alunos/${id}`, { idade: 7 });
    expect(editado.body.idade).toBe(7);

    const volta = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'joão', idade: 7 });
    expect(volta.body.novo).toBe(false);
    expect(volta.body.aluno.id).toBe(id);
  });

  it('não deixa ficar igual a outro aluno da turma (RN04)', async () => {
    await aulaAberta();
    const ana = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });
    await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 7 });

    const res = await prof.patch(`/api/alunos/${ana.body.aluno.id}`, { idade: 7 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALUNO_JA_EXISTE');
  });

  it('desativa e reativa (RF-D08); lista da turma mostra o status', async () => {
    const { turmaId } = await aulaAberta();
    const ana = await request(app).post('/api/auth/aluno/entrar').send({ nome: 'Ana', idade: 6 });

    await prof.post(`/api/alunos/${ana.body.aluno.id}/desativar`);
    const lista = await prof.get(`/api/turmas/${turmaId}/alunos`);
    expect(lista.body[0]).toMatchObject({ nome: 'Ana', status: 'DESATIVADO' });

    const reativado = await prof.post(`/api/alunos/${ana.body.aluno.id}/reativar`);
    expect(reativado.body.status).toBe('ATIVO');
  });
});

describe('Professores', () => {
  it('cadastra outro professor, que consegue logar', async () => {
    const novo = await prof.post('/api/professores', {
      nome: 'Leonardo',
      email: 'leo@escola.com',
      senha: 'outra-senha-1',
    });
    expect(novo.status).toBe(201);
    expect(novo.body.senhaHash).toBeUndefined();

    const login = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'leo@escola.com', senha: 'outra-senha-1' });
    expect(login.status).toBe(200);
    expect((await prof.get('/api/professores')).body).toHaveLength(2);
  });

  it('troca a própria senha (precisa da senha atual)', async () => {
    const errada = await prof.put('/api/professores/eu/senha', {
      senhaAtual: 'x',
      novaSenha: 'nova-senha-99',
    });
    expect(errada.body.error.code).toBe('SENHA_ATUAL_INCORRETA');

    const ok = await prof.put('/api/professores/eu/senha', {
      senhaAtual: 'senha-123456',
      novaSenha: 'nova-senha-99',
    });
    expect(ok.status).toBe(204);

    const login = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'prof@escola.com', senha: 'nova-senha-99' });
    expect(login.status).toBe(200);
  });

  it('desativa outro professor, mas não a si mesmo', async () => {
    const leo = await prof.post('/api/professores', {
      nome: 'Leo',
      email: 'leo@escola.com',
      senha: 'outra-senha-1',
    });
    const desativado = await prof.patch(`/api/professores/${leo.body.id}`, { ativo: false });
    expect(desativado.body.ativo).toBe(false);

    const login = await request(app)
      .post('/api/auth/professor/login')
      .send({ email: 'leo@escola.com', senha: 'outra-senha-1' });
    expect(login.status).toBe(401);

    const eu = await prof.get('/api/auth/eu');
    const res = await prof.patch(`/api/professores/${eu.body.professor.id}`, { ativo: false });
    expect(res.body.error.code).toBe('NAO_PODE_DESATIVAR_A_SI_MESMO');
  });
});