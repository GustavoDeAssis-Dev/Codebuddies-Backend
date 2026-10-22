import { describe, expect, it } from 'vitest';
import type { Progresso } from '../src/domain/entidades.js';
import {
  avaliarDesempenho,
  calcularPercentual,
  percentualParaEstrelas,
} from '../src/domain/regras/estrelas.js';
import { limparNome, normalizarNome } from '../src/domain/regras/identificacao.js';
import { montarMapaDeFases } from '../src/domain/regras/progressao.js';
import { montarRanking } from '../src/domain/regras/ranking.js';
import { conteudoInicial } from '../src/repositories/memoria/conteudo-inicial.js';

describe('Estrelas por porcentagem de acertos (RF-P10 / RN05)', () => {
  it.each([
    [100, 5],
    [90, 5],
    [89, 4],
    [75, 4],
    [74, 3],
    [60, 3],
    [59, 2],
    [40, 2],
    [39, 1],
    [20, 1],
    [19, 0],
    [0, 0],
  ])('%i%% → %i estrelas', (pct, estrelas) => {
    expect(percentualParaEstrelas(pct)).toBe(estrelas);
  });

  it('conta todas as respostas: 10 acertos e 3 erros = 76% = 4 estrelas', () => {
    expect(avaliarDesempenho(10, 3)).toEqual({ percentual: 76, estrelas: 4, aprovada: true });
  });

  it('arredonda para baixo: 2 de 3 = 66%', () => {
    expect(calcularPercentual(2, 1)).toBe(66);
  });

  it('aprovação a partir de 3 estrelas (RN05)', () => {
    expect(avaliarDesempenho(6, 4).aprovada).toBe(true); // 60%
    expect(avaliarDesempenho(5, 5).aprovada).toBe(false); // 50%
  });

  it('rejeita entrada sem respostas ou negativa', () => {
    expect(() => calcularPercentual(0, 0)).toThrow();
    expect(() => calcularPercentual(-1, 2)).toThrow();
  });
});

describe('Identificação por nome (RN04)', () => {
  it('normaliza acentos, maiúsculas e espaços', () => {
    expect(normalizarNome('  João   PEDRO ')).toBe('joao pedro');
    expect(normalizarNome('joao pedro')).toBe('joao pedro');
    expect(limparNome('  João   Pedro ')).toBe('João Pedro');
  });
});

describe('Mapa de fases e desbloqueio (RN07 / RN13)', () => {
  const { fases } = conteudoInicial();
  const prog = (faseId: number, melhorEstrelas: number): Progresso => ({
    alunoId: 1,
    faseId,
    melhorEstrelas,
    tentativas: 1,
    melhorTempoSegundos: 10,
    concluida: melhorEstrelas >= 3,
    ultimaTentativaEm: new Date(),
  });

  it('aluno novo: só a primeira fase liberada, nível 1', () => {
    const mapa = montarMapaDeFases(fases, []);
    expect(mapa.fases.map((f) => f.status)).toEqual([
      'LIBERADA',
      'BLOQUEADA',
      'BLOQUEADA',
      'BLOQUEADA',
      'BLOQUEADA',
      'BLOQUEADA',
    ]);
    expect(mapa.nivelAtual).toBe(1);
  });

  it('fase com 3+ estrelas conclui e libera a próxima, inclusive de outro nível', () => {
    const mapa = montarMapaDeFases(fases, [prog(1, 4), prog(2, 3)]);
    expect(mapa.fases.slice(0, 4).map((f) => f.status)).toEqual([
      'CONCLUIDA',
      'CONCLUIDA',
      'LIBERADA',
      'BLOQUEADA',
    ]);
    expect(mapa.nivelAtual).toBe(2);
    expect(mapa.estrelasTotais).toBe(7);
  });

  it('menos de 3 estrelas não libera a próxima (RN14)', () => {
    const mapa = montarMapaDeFases(fases, [prog(1, 2)]);
    expect(mapa.fases[0]!.status).toBe('LIBERADA');
    expect(mapa.fases[1]!.status).toBe('BLOQUEADA');
  });

  it('todas concluídas → fica no último nível', () => {
    const mapa = montarMapaDeFases(
      fases,
      fases.map((f) => prog(f.id, 5)),
    );
    expect(mapa.todasConcluidas).toBe(true);
    expect(mapa.nivelAtual).toBe(3);
  });
});

describe('Ranking (RF-P13)', () => {
  const p = (nome: string, nivel: number, estrelas: number, tempo: number) => ({
    alunoId: nome.length,
    nome,
    nivelAlcancado: nivel,
    estrelasNaSessao: estrelas,
    fasesConcluidasNaSessao: 0,
    tempoTotalSegundos: tempo,
  });

  it('ordena por nível, depois estrelas, depois menor tempo', () => {
    const r = montarRanking([
      p('Ana', 2, 10, 300),
      p('Bia', 3, 5, 500),
      p('Caio', 2, 10, 200),
      p('Duda', 2, 12, 900),
    ]);
    expect(r.map((i) => [i.posicao, i.nome])).toEqual([
      [1, 'Bia'],
      [2, 'Duda'],
      [3, 'Caio'],
      [4, 'Ana'],
    ]);
  });

  it('empate total divide a posição (1º, 2º, 2º, 4º)', () => {
    const r = montarRanking([p('A', 3, 9, 100), p('B', 2, 5, 100), p('C', 2, 5, 100), p('D', 1, 1, 1)]);
    expect(r.map((i) => i.posicao)).toEqual([1, 2, 2, 4]);
  });
});
