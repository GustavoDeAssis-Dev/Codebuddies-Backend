import type { ItemRanking } from '../entidades.js';

/**
 * RF-P13 / RF-D12 — Critério do ranking final da aula.
 *
 * Ordem:
 *   1º maior NÍVEL alcançado (nível em que o aluno está ao fim da aula)
 *   2º mais ESTRELAS conquistadas NESTA aula (melhor resultado de cada fase jogada na sessão)
 *   3º desempate: MENOR tempo total (soma do tempo da melhor tentativa de cada fase na sessão)
 *
 * Empate total → mesma posição (ex.: 1º, 2º, 2º, 4º).
 *
 * ➜ Para mudar o critério, basta alterar a função `compararRanking`.
 */

export type DadosRanking = Omit<ItemRanking, 'posicao'>;

export function compararRanking(a: DadosRanking, b: DadosRanking): number {
  return (
    b.nivelAlcancado - a.nivelAlcancado ||
    b.estrelasNaSessao - a.estrelasNaSessao ||
    a.tempoTotalSegundos - b.tempoTotalSegundos
  );
}

export function montarRanking(participantes: DadosRanking[]): ItemRanking[] {
  const ordenados = [...participantes].sort(
    (a, b) => compararRanking(a, b) || a.nome.localeCompare(b.nome, 'pt-BR'),
  );

  return ordenados.map((p, i, lista) => {
    let posicao = i + 1;
    // Empate: herda a posição de quem está acima
    for (let j = i - 1; j >= 0 && compararRanking(lista[j]!, p) === 0; j--) posicao = j + 1;
    return { posicao, ...p };
  });
}
