import type { Desafio } from '../entidades.js';

/**
 * Etapa 7 — Correção das respostas, feita SEMPRE no back-end (o front não decide quem acertou).
 *
 * Crianças de 5 a 8 anos digitam "a", "A", " a " ou "á" querendo dizer a mesma coisa,
 * então a comparação ignora maiúsculas/minúsculas, acentos e espaços extras.
 */

/** "  Guarda   chuvá " → "GUARDA CHUVA" */
export function normalizarResposta(texto: string): string {
  return texto
    .normalize('NFD') // separa a letra do acento: "á" vira "a" + "´"
    .replace(/\p{M}/gu, '') // remove os acentos
    .toUpperCase()
    .replace(/\s+/g, ' ') // vários espaços viram um só
    .trim();
}

/** true se a resposta da criança é igual à correta (resposta vazia ou pulada = errada). */
export function estaCorreta(submetida: string | null, correta: string): boolean {
  if (submetida === null) return false;
  const resposta = normalizarResposta(submetida);
  return resposta.length > 0 && resposta === normalizarResposta(correta);
}

export interface ItemCorrigido {
  desafioId: number;
  respostaSubmetida: string | null;
  acertou: boolean;
  pontos: number; // pontos do desafio se acertou; 0 se errou
}

export interface Correcao {
  itens: ItemCorrigido[]; // um por desafio da fase, na ordem da fase
  acertos: number;
  erros: number;
  pontos: number; // soma dos pontos dos desafios acertados
  pontosPossiveis: number;
}

/**
 * Corrige a fase inteira. Cada desafio da fase gera um item; desafio sem resposta conta como erro.
 * Pressupõe respostas já validadas (todas da fase e sem repetição) — o service confere isso antes.
 */
export function corrigirFase(
  desafios: Desafio[],
  respostas: { desafioId: number; resposta: string }[],
): Correcao {
  const porDesafio = new Map(respostas.map((r) => [r.desafioId, r.resposta]));

  const itens = desafios.map((d) => {
    const submetida = porDesafio.get(d.id) ?? null;
    const acertou = estaCorreta(submetida, d.respostaCorreta);
    return { desafioId: d.id, respostaSubmetida: submetida, acertou, pontos: acertou ? d.pontos : 0 };
  });

  const acertos = itens.filter((i) => i.acertou).length;
  return {
    itens,
    acertos,
    erros: itens.length - acertos,
    pontos: itens.reduce((soma, i) => soma + i.pontos, 0),
    pontosPossiveis: desafios.reduce((soma, d) => soma + d.pontos, 0),
  };
}