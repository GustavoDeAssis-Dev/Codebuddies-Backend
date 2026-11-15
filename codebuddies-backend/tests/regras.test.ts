import { describe, expect, it } from 'vitest';
import type { Progresso, Tentativa } from '../src/domain/entidades.js';
import {
  avaliarDesempenho,
  calcularPercentual,
  percentualParaEstrelas,
} from '../src/domain/regras/estrelas.js';
import { limparNome, normalizarNome } from '../src/domain/regras/identificacao.js';
import { montarMapaDeFases, consolidarProgresso } from '../src/domain/regras/progressao.js';
import { montarRanking } from '../src/domain/regras/ranking.js';
import { conteudoInicial } from '../src/repositories/memoria/conteudo-inicial.js';
import { corrigirFase, estaCorreta, normalizarResposta } from '../src/domain/regras/correcao.js';
import { calcularConquistas, novasConquistas } from '../src/domain/regras/conquistas.js';

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
    ])('%i por cento → %i estrelas', (pct, estrelas) => {
    expect(percentualParaEstrelas(pct)).toBe(estrelas);
  });

  it('conta todas as respostas: 10 acertos e 3 erros = 76% = 4 estrelas', () => {
        expect(avaliarDesempenho(10, 3)).toEqual({ percentual: 76, estrelas: 4, aprovada: true, pontos: 1000 });
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
    pontuacaoMaxima: melhorEstrelas * 200,
    concluida: melhorEstrelas >= 3,
    atualizadoEm: new Date(),
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
describe('Consolidação do progresso (igual à trigger TRG_ATUALIZA_PROGRESSO_OFICIAL)', () => {
  const t = (estrelas: number, pontos: number) => ({
    id: 1,
    alunoId: 1,
    faseId: 1,
    sessaoId: 1,
    percentual: 0,
    estrelas,
    pontos,
    aprovada: estrelas >= 3,
    tempoSegundos: 10,
    dataHora: new Date(),
  });

  it('primeira tentativa cria o progresso', () => {
    expect(consolidarProgresso(null, t(2, 200))).toMatchObject({ melhorEstrelas: 2, concluida: false });
  });

  it('só melhora com mais estrelas, ou mesmas estrelas e mais pontos', () => {
    const p1 = consolidarProgresso(null, t(3, 300));
    expect(consolidarProgresso(p1, t(2, 900))).toBe(p1); // pior: não muda
    expect(consolidarProgresso(p1, t(3, 400)).pontuacaoMaxima).toBe(400); // empate, mais pontos
    expect(consolidarProgresso(p1, t(5, 100)).melhorEstrelas).toBe(5);
  });

  it('fase concluída não volta a ficar não concluída', () => {
    const p1 = consolidarProgresso(null, t(4, 400));
    expect(consolidarProgresso(p1, t(1, 100)).concluida).toBe(true);
  });
});
describe('Correção das respostas (Etapa 7)', () => {
  const desafio = (id: number, respostaCorreta: string, pontos = 100) => ({
    id,
    faseId: 1,
    ordem: id,
    enunciado: '?',
    respostaCorreta,
    pontos,
  });

  it('ignora maiúsculas, acentos e espaços extras', () => {
    expect(normalizarResposta('  Guarda   chuvá ')).toBe('GUARDA CHUVA');
    expect(estaCorreta('a', 'A')).toBe(true);
    expect(estaCorreta(' ó ', 'O')).toBe(true);
    expect(estaCorreta('E', 'A')).toBe(false);
  });

  it('resposta vazia ou pulada é errada', () => {
    expect(estaCorreta('', 'A')).toBe(false);
    expect(estaCorreta('   ', 'A')).toBe(false);
    expect(estaCorreta(null, 'A')).toBe(false);
  });

  it('pontos = soma dos pontos dos desafios acertados; pulado conta como erro', () => {
    const c = corrigirFase(
      [desafio(1, 'A'), desafio(2, 'O', 150), desafio(3, 'U')],
      [
        { desafioId: 1, resposta: 'a' },
        { desafioId: 2, resposta: 'o' },
      ],
    );
    expect(c).toMatchObject({ acertos: 2, erros: 1, pontos: 250, pontosPossiveis: 350 });
    expect(c.itens[2]).toEqual({ desafioId: 3, respostaSubmetida: null, acertou: false, pontos: 0 });
  });

  it('os itens seguem a ordem dos desafios da fase', () => {
    const c = corrigirFase(
      [desafio(1, 'A'), desafio(2, 'B')],
      [
        { desafioId: 2, resposta: 'B' },
        { desafioId: 1, resposta: 'X' },
      ],
    );
    expect(c.itens.map((i) => [i.desafioId, i.acertou])).toEqual([
      [1, false],
      [2, true],
    ]);
  });
});

describe('Conquistas (Etapa 8)', () => {
  const { fases } = conteudoInicial(); // 3 níveis, 6 fases (nível 1 = fases 1 e 2)
  const prog = (faseId: number, estrelas: number): Progresso => ({
    alunoId: 1,
    faseId,
    melhorEstrelas: estrelas,
    pontuacaoMaxima: estrelas * 100,
    concluida: estrelas >= 3,
    atualizadoEm: new Date(),
  });
  const tent = (id: number, faseId: number, estrelas: number): Tentativa => ({
    id,
    alunoId: 1,
    faseId,
    sessaoId: 1,
    percentual: 0,
    estrelas,
    pontos: 0,
    aprovada: estrelas >= 3,
    tempoSegundos: 10,
    dataHora: new Date(2026, 0, 1, 10, id), // a tentativa 2 é depois da 1
  });
  const ganhas = (progressos: Progresso[], tentativas: Tentativa[] = []) =>
    calcularConquistas({ fases, progressos, tentativas })
      .filter((c) => c.conquistada)
      .map((c) => c.codigo);

  it('aluno novo vê as 6 conquistas, todas bloqueadas', () => {
    const lista = calcularConquistas({ fases, progressos: [], tentativas: [] });
    expect(lista).toHaveLength(6);
    expect(lista.every((c) => !c.conquistada)).toBe(true);
  });

  it('primeira fase concluída e 5 estrelas', () => {
    expect(ganhas([prog(1, 2)])).toEqual([]); // 2 estrelas não conclui
    expect(ganhas([prog(1, 3)])).toEqual(['PRIMEIRA_FASE']);
    expect(ganhas([prog(1, 5)])).toEqual(['PRIMEIRA_FASE', 'PERFEITO']);
  });

  it('subiu de nível só ao concluir TODAS as fases do nível', () => {
    expect(ganhas([prog(1, 3)])).not.toContain('SUBIU_DE_NIVEL');
    expect(ganhas([prog(1, 3), prog(2, 3)])).toContain('SUBIU_DE_NIVEL');
  });

  it('não desistiu: refez a fase e MELHOROU', () => {
    expect(ganhas([prog(1, 4)], [tent(1, 1, 2), tent(2, 1, 4)])).toContain('NAO_DESISTIU');
    expect(ganhas([prog(1, 4)], [tent(1, 1, 4), tent(2, 1, 2)])).not.toContain('NAO_DESISTIU'); // piorou
    expect(ganhas([prog(1, 4)], [tent(1, 1, 4)])).not.toContain('NAO_DESISTIU'); // jogou uma vez só
  });

  it('todas as fases com 5 estrelas → colecionador e mestre', () => {
    expect(ganhas(fases.map((f) => prog(f.id, 5)))).toEqual([
      'PRIMEIRA_FASE',
      'PERFEITO',
      'SUBIU_DE_NIVEL',
      'COLECIONADOR',
      'MESTRE',
    ]);
  });

  it('novasConquistas mostra só o que acabou de ganhar', () => {
    const antes = calcularConquistas({ fases, progressos: [prog(1, 3)], tentativas: [] });
    const depois = calcularConquistas({ fases, progressos: [prog(1, 5)], tentativas: [] });
    expect(novasConquistas(antes, depois).map((c) => c.codigo)).toEqual(['PERFEITO']);
  });
});