import type { Desafio, FaseComNivel, Nivel } from '../../domain/entidades.js';

export interface ConteudoInicial {
  niveis: Nivel[];
  fases: FaseComNivel[];
  desafios: Desafio[];
}

/**
 * Conteúdo de exemplo (níveis, fases e desafios) para o banco em memória.
 * No Oracle, o conteúdo vem das tabelas NIVEL, FASE e DESAFIO (cadastrado pelo professor).
 */
export function conteudoInicial(): ConteudoInicial {
  const niveis: Nivel[] = [
    { id: 1, ordem: 1, titulo: 'Conhecendo o computador', descricao: null },
    { id: 2, ordem: 2, titulo: 'Primeiras letras', descricao: null },
    { id: 3, ordem: 3, titulo: 'Pensando com lógica', descricao: null },
  ];

  const base = [
    { id: 1, nivelId: 1, ordem: 1, titulo: 'Clique nos balões', tipo: 'COMPUTACAO_BASICA' },
    { id: 2, nivelId: 1, ordem: 2, titulo: 'Encontre as teclas', tipo: 'COMPUTACAO_BASICA' },
    { id: 3, nivelId: 2, ordem: 1, titulo: 'Vogais', tipo: 'DIGITACAO' },
    { id: 4, nivelId: 2, ordem: 2, titulo: 'Palavras curtas', tipo: 'DIGITACAO' },
    { id: 5, nivelId: 3, ordem: 1, titulo: 'Complete a sequência', tipo: 'LOGICA' },
    { id: 6, nivelId: 3, ordem: 2, titulo: 'Se chover, então...', tipo: 'LOGICA' },
  ] as const;

  const fases: FaseComNivel[] = base.map((f) => ({
    ...f,
    nivel: niveis.find((n) => n.id === f.nivelId)!,
  }));

  // [faseId, enunciado, resposta correta]
  const perguntas: [number, string, string][] = [
    [1, 'Quantos balões vermelhos aparecem na tela?', '3'],
    [1, 'Clique no balão azul. Qual é a cor dele?', 'AZUL'],
    [1, 'Quantos balões estouraram?', '2'],
    [2, 'Aperte a tecla que apaga uma letra', 'BACKSPACE'],
    [2, 'Aperte a tecla que pula para a linha de baixo', 'ENTER'],
    [2, 'Aperte a tecla do espaço', 'ESPACO'],
    [3, 'Digite a vogal que começa a palavra ABELHA', 'A'],
    [3, 'Digite a vogal que começa a palavra OVO', 'O'],
    [3, 'Digite a vogal que começa a palavra UVA', 'U'],
    [4, 'Digite a palavra SOL', 'SOL'],
    [4, 'Digite a palavra LUA', 'LUA'],
    [4, 'Digite a palavra MAR', 'MAR'],
    [5, 'Complete: 1, 2, 3, __', '4'],
    [5, 'Complete: 2, 4, 6, __', '8'],
    [5, 'Complete: 🔴 🔵 🔴 🔵 __ (VERMELHO ou AZUL)', 'VERMELHO'],
    [6, 'Se chover, eu levo o quê? (GUARDA-CHUVA ou OCULOS)', 'GUARDA-CHUVA'],
    [6, 'Se estiver escuro, eu acendo a... (LUZ ou TV)', 'LUZ'],
    [6, 'Se eu estiver com fome, eu... (COMO ou DURMO)', 'COMO'],
  ];

  const desafios: Desafio[] = perguntas.map(([faseId, enunciado, respostaCorreta], i) => ({
    id: i + 1,
    faseId,
    ordem: perguntas.slice(0, i).filter(([f]) => f === faseId).length + 1,
    enunciado,
    respostaCorreta,
    pontos: 100,
  }));

  return { niveis, fases, desafios };
}