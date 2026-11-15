import { beforeEach, describe, expect, it } from 'vitest';
import { AlunosService } from '../src/modules/alunos/alunos.service.js';
import { ProgressoService } from '../src/modules/progresso/progresso.service.js';
import { RankingService } from '../src/modules/ranking/ranking.service.js';
import { SessoesService } from '../src/modules/sessoes/sessoes.service.js';
import { TentativasService } from '../src/modules/tentativas/tentativas.service.js';
import { conteudoInicial } from '../src/repositories/memoria/conteudo-inicial.js';
import { criarRepositoriosEmMemoria } from '../src/repositories/memoria/index.js';
import type { Contexto } from '../src/shared/contexto.js';

/**
 * Conteúdo de teste: as 6 fases de exemplo, cada uma com 10 desafios
 * (resposta "OK", 100 pontos). Com 10 desafios dá para testar qualquer porcentagem: 8 certas = 80%.
 * O id do desafio é faseId * 100 + posição → fase 1: 101 a 110; fase 2: 201 a 210...
 */
function conteudoCom10Desafios() {
  const base = conteudoInicial();
  const desafios = base.fases.flatMap((f) =>
    Array.from({ length: 10 }, (_, i) => ({
      id: f.id * 100 + i + 1,
      faseId: f.id,
      ordem: i + 1,
      enunciado: `Desafio ${i + 1}`,
      respostaCorreta: 'OK',
      pontos: 100,
    })),
  );
  return { ...base, desafios };
}

/** Monta um "sistema" novo, com banco em memória, para cada teste. */
function montar() {
  const ctx: Contexto = {
    repos: criarRepositoriosEmMemoria(conteudoCom10Desafios()),
    agora: () => new Date('2026-10-14T13:00:00Z'),
  };
  return {
    ctx,
    sessoes: new SessoesService(ctx),
    alunos: new AlunosService(ctx),
    progresso: new ProgressoService(ctx),
    tentativas: new TentativasService(ctx),
    ranking: new RankingService(ctx),
  };
}

type Sistema = ReturnType<typeof montar>;

async function abrirAula(s: Sistema, turmaId?: number) {
  const id = turmaId ?? (await s.ctx.repos.turmas.criar({ nome: '2º ano B', criadaEm: new Date() })).id;
  const sessao = await s.sessoes.criar(id, 1);
  await s.sessoes.abrir(sessao.id);
  return { turmaId: id, sessaoId: sessao.id };
}

/** Joga uma fase respondendo os 10 desafios: as primeiras `acertos` certas, o resto errado. */
const jogar = (s: Sistema, alunoId: number, faseId: number, acertos: number, tempo = 30) =>
  s.tentativas.registrar(alunoId, {
    faseId,
    tempoSegundos: tempo,
    respostas: Array.from({ length: 10 }, (_, i) => ({
      desafioId: faseId * 100 + i + 1,
      resposta: i < acertos ? 'ok' : 'errei',
    })),
  });

describe('Fluxo da aula — critérios de aceitação', () => {
  let s: Sistema;
  beforeEach(() => {
    s = montar();
  });

  it('CA01 / RN02 — sem sessão aberta, o aluno não consegue entrar', async () => {
    await expect(s.alunos.entrar({ nome: 'Ana', idade: 6 })).rejects.toMatchObject({
      code: 'SESSAO_FECHADA',
    });
  });

  it('CA02 / RN03 — nome vazio é recusado com "Digite seu nome"', async () => {
    await abrirAula(s);
    await expect(s.alunos.entrar({ nome: '   ', idade: 6 })).rejects.toThrow(/Digite seu nome/);
    await expect(s.alunos.entrar({ nome: 'Ana', idade: undefined as unknown as number })).rejects.toThrow(
      /Digite sua idade/,
    );
  });

  it('CA03 / RN04 — mesmo nome+idade recupera o perfil, sem duplicar', async () => {
    await abrirAula(s);
    const primeira = await s.alunos.entrar({ nome: 'João Pedro', idade: 6 });
    const segunda = await s.alunos.entrar({ nome: '  joao   pedro ', idade: 6 });
    const outraIdade = await s.alunos.entrar({ nome: 'João Pedro', idade: 7 });

    expect(primeira.novo).toBe(true);
    expect(segunda.novo).toBe(false);
    expect(segunda.aluno.id).toBe(primeira.aluno.id);
    expect(outraIdade.aluno.id).not.toBe(primeira.aluno.id);
  });

  it('RN01 — só uma sessão aberta por vez', async () => {
    const { turmaId } = await abrirAula(s);
    const outra = await s.sessoes.criar(turmaId, 1);
    await expect(s.sessoes.abrir(outra.id)).rejects.toMatchObject({ code: 'OUTRA_SESSAO_ABERTA' });
  });

  it('RF-P07 / RN07 — não deixa jogar fase bloqueada', async () => {
    await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });
    await expect(jogar(s, aluno.id, 2, 10)).rejects.toMatchObject({ code: 'FASE_BLOQUEADA' });
  });

  it('CA04 / CA05 — termina fase, recebe 0–5 estrelas e libera a próxima com 3+', async () => {
    await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });

    const r = await jogar(s, aluno.id, 1, 8); // 80%
    expect(r.estrelas).toBe(4);
    expect(r.aprovada).toBe(true);
    expect(r.proximaFaseId).toBe(2);

    const mapa = await s.progresso.mapaDoAluno(aluno.id);
    expect(mapa.fases[0]!.status).toBe('CONCLUIDA');
    expect(mapa.fases[1]!.status).toBe('LIBERADA');
  });

  it('CA06 / RN14 — com menos de 3 estrelas pode repetir, mas não avança', async () => {
    await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });

    const r = await jogar(s, aluno.id, 1, 5); // 50% → 2 estrelas
    expect(r.estrelas).toBe(2);
    expect(r.aprovada).toBe(false);
    expect(r.proximaFaseId).toBeNull();
    await expect(jogar(s, aluno.id, 2, 10)).rejects.toMatchObject({ code: 'FASE_BLOQUEADA' });
    await expect(jogar(s, aluno.id, 1, 9)).resolves.toMatchObject({ estrelas: 5 }); // refaz
  });

  it('CA07 / RN06 / RN15 — vale sempre a melhor tentativa', async () => {
    await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });

    await jogar(s, aluno.id, 1, 6); // 3 estrelas
    const melhor = await jogar(s, aluno.id, 1, 10); // 5 estrelas
    const pior = await jogar(s, aluno.id, 1, 2); // 1 estrela

    expect(melhor.novoRecorde).toBe(true);
    expect(pior.novoRecorde).toBe(false);
    expect(pior.melhorEstrelas).toBe(5);

    const mapa = await s.progresso.mapaDoAluno(aluno.id);
    expect(mapa.fases[0]).toMatchObject({ status: 'CONCLUIDA', melhorEstrelas: 5 });
    expect(mapa.estrelasTotais).toBe(5);
  });

  it('CA08 / CA09 / RN08 — ranking oculto durante a aula e congelado ao encerrar', async () => {
    const { sessaoId } = await abrirAula(s);
    const ana = (await s.alunos.entrar({ nome: 'Ana', idade: 6 })).aluno;
    const bia = (await s.alunos.entrar({ nome: 'Bia', idade: 7 })).aluno;
    const caio = (await s.alunos.entrar({ nome: 'Caio', idade: 6 })).aluno;

    await jogar(s, ana.id, 1, 10); // nível 1 → fase 2 liberada
    await jogar(s, ana.id, 2, 10); // conclui nível 1 → nível 2
    await jogar(s, bia.id, 1, 10, 20);
    await jogar(s, caio.id, 1, 10, 40);

    await expect(s.ranking.obter(sessaoId)).rejects.toMatchObject({ code: 'RANKING_INDISPONIVEL' });

    const { ranking } = await s.sessoes.encerrar(sessaoId);
    expect(ranking.itens.map((i) => [i.posicao, i.nome, i.nivelAlcancado, i.estrelasNaSessao])).toEqual([
      [1, 'Ana', 2, 10],
      [2, 'Bia', 1, 5], // mesmo nível/estrelas que Caio, mas mais rápida
      [3, 'Caio', 1, 5],
    ]);
    expect(await s.ranking.obter(sessaoId)).toEqual(ranking);
  });

  it('RF-D05 — depois de encerrar, ninguém entra nem joga', async () => {
    const { sessaoId } = await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });
    await s.sessoes.encerrar(sessaoId);

    await expect(s.alunos.entrar({ nome: 'Bia', idade: 6 })).rejects.toMatchObject({
      code: 'SESSAO_FECHADA',
    });
    await expect(jogar(s, aluno.id, 1, 10)).rejects.toMatchObject({ code: 'SESSAO_FECHADA' });
    await expect(s.sessoes.abrir(sessaoId)).rejects.toMatchObject({ code: 'SESSAO_ENCERRADA' });
  });

  it('CA10 / RN10 — aluno desativado sai do ranking mas os dados ficam guardados', async () => {
    const { sessaoId } = await abrirAula(s);
    const ana = (await s.alunos.entrar({ nome: 'Ana', idade: 6 })).aluno;
    const bia = (await s.alunos.entrar({ nome: 'Bia', idade: 6 })).aluno;
    await jogar(s, ana.id, 1, 10);
    await s.alunos.desativar(ana.id);

    await expect(jogar(s, ana.id, 1, 10)).rejects.toMatchObject({ code: 'ALUNO_DESATIVADO' });
    await expect(s.alunos.entrar({ nome: 'Ana', idade: 6 })).rejects.toMatchObject({
      code: 'ALUNO_DESATIVADO',
    });

    const { ranking } = await s.sessoes.encerrar(sessaoId);
    expect(ranking.itens.map((i) => i.alunoId)).toEqual([bia.id]);
    expect(await s.ctx.repos.tentativas.listarPorSessao(sessaoId)).toHaveLength(1); // tentativa mantida
    expect((await s.progresso.mapaDoAluno(ana.id)).estrelasTotais).toBe(5); // progresso mantido

    await s.alunos.reativar(ana.id);
    expect((await s.alunos.buscar(ana.id)).status).toBe('ATIVO');
  });

  it('Opção B — o aluno continua de onde parou na aula seguinte da mesma turma', async () => {
    const aula1 = await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'João', idade: 6 });
    await jogar(s, aluno.id, 1, 10);
    await jogar(s, aluno.id, 2, 10);
    await s.sessoes.encerrar(aula1.sessaoId);

    const aula2 = await abrirAula(s, aula1.turmaId);
    const volta = await s.alunos.entrar({ nome: 'joão', idade: 6 });
    expect(volta.novo).toBe(false);
    expect(volta.aluno.id).toBe(aluno.id);
    expect((await s.progresso.mapaDoAluno(aluno.id)).nivelAtual).toBe(2);

    // No ranking da aula 2 contam só as estrelas ganhas na aula 2
    await jogar(s, aluno.id, 3, 6); // 3 estrelas
    const { ranking } = await s.sessoes.encerrar(aula2.sessaoId);
    expect(ranking.itens[0]).toMatchObject({ nivelAlcancado: 2, estrelasNaSessao: 3 });
  });

  it('Opção B — mesmo nome em OUTRA turma é outro aluno', async () => {
    const aula1 = await abrirAula(s);
    const joaoA = (await s.alunos.entrar({ nome: 'João', idade: 6 })).aluno;
    await s.sessoes.encerrar(aula1.sessaoId);

    await abrirAula(s); // turma nova
    const joaoB = (await s.alunos.entrar({ nome: 'João', idade: 6 })).aluno;
    expect(joaoB.id).not.toBe(joaoA.id);
  });

  it('aluno que não entrou na aula não pode registrar tentativa', async () => {
    const aula1 = await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });
    await s.sessoes.encerrar(aula1.sessaoId);
    await abrirAula(s, aula1.turmaId);
    await expect(jogar(s, aluno.id, 1, 10)).rejects.toMatchObject({ code: 'ALUNO_FORA_DA_SESSAO' });
  });

  it('Etapa 7 — o back corrige as respostas e grava uma por desafio', async () => {
    await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });

    const r = await s.tentativas.registrar(aluno.id, {
      faseId: 1,
      tempoSegundos: 20,
      respostas: [
        { desafioId: 101, resposta: ' ok ' }, // certa (espaços ignorados)
        { desafioId: 102, resposta: 'Ok' }, // certa (maiúscula ignorada)
        { desafioId: 103, resposta: 'não sei' }, // errada
      ], // os outros 7 desafios foram pulados → contam como erro
    });

    expect(r).toMatchObject({
      acertos: 2,
      erros: 8,
      percentual: 20,
      estrelas: 1,
      pontos: 200,
      pontosPossiveis: 1000,
    });
    expect(r.desafios[2]).toEqual({ desafioId: 103, ordem: 3, acertou: false, pontos: 0 });

    const gravadas = await s.ctx.repos.respostas.listarPorTentativa(r.tentativa.id);
    expect(gravadas).toHaveLength(10); // uma linha por desafio da fase
    expect(gravadas.filter((g) => g.respostaSubmetida === null)).toHaveLength(7); // puladas
  });

  it('Etapa 7 — resposta de outra fase ou repetida é recusada (e nada é gravado)', async () => {
    const { sessaoId } = await abrirAula(s);
    const { aluno } = await s.alunos.entrar({ nome: 'Ana', idade: 6 });
    const enviar = (respostas: { desafioId: number; resposta: string }[]) =>
      s.tentativas.registrar(aluno.id, { faseId: 1, tempoSegundos: 5, respostas });

    await expect(enviar([{ desafioId: 201, resposta: 'ok' }])).rejects.toMatchObject({
      code: 'DESAFIO_FORA_DA_FASE',
    });
    await expect(
      enviar([
        { desafioId: 101, resposta: 'ok' },
        { desafioId: 101, resposta: 'ok' },
      ]),
    ).rejects.toMatchObject({ code: 'RESPOSTA_DUPLICADA' });
    expect(await s.ctx.repos.tentativas.listarPorSessao(sessaoId)).toHaveLength(0);
  });
});