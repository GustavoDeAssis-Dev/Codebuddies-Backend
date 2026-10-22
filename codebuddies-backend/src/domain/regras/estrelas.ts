/**
 * RF-P10 / RN05 / RN09 — Cálculo da nota e conversão em 0 a 5 estrelas.
 *
 * Nota = porcentagem de acertos = acertos / (acertos + erros).
 * Cada resposta dada pela criança conta (inclusive tentativas erradas antes de acertar).
 *   Ex.: digitar 10 letras apertando 13 teclas (3 erradas) → 10/13 = 76% → 4 estrelas.
 *
 * O cálculo é SEMPRE feito no servidor: o front envia acertos/erros, nunca as estrelas.
 */

export const ESTRELAS_MINIMAS_APROVACAO = 3; // RN05

/** Faixas de porcentagem (mínimo inclusivo) → estrelas. Ordenadas da maior para a menor. */
export const FAIXAS_ESTRELAS = [
  { minimo: 90, estrelas: 5 },
  { minimo: 75, estrelas: 4 },
  { minimo: 60, estrelas: 3 },
  { minimo: 40, estrelas: 2 },
  { minimo: 20, estrelas: 1 },
] as const;

/** Porcentagem inteira (arredondada para baixo: 89,9% conta como 89%). */
export function calcularPercentual(acertos: number, erros: number): number {
  if (!Number.isInteger(acertos) || !Number.isInteger(erros) || acertos < 0 || erros < 0) {
    throw new RangeError('acertos e erros devem ser inteiros >= 0');
  }
  const total = acertos + erros;
  if (total === 0) throw new RangeError('é preciso ao menos uma resposta');
  return Math.floor((acertos * 100) / total);
}

export function percentualParaEstrelas(percentual: number): number {
  return FAIXAS_ESTRELAS.find((f) => percentual >= f.minimo)?.estrelas ?? 0;
}

export function estaAprovado(estrelas: number): boolean {
  return estrelas >= ESTRELAS_MINIMAS_APROVACAO;
}

export function avaliarDesempenho(acertos: number, erros: number) {
  const percentual = calcularPercentual(acertos, erros);
  const estrelas = percentualParaEstrelas(percentual);
  return { percentual, estrelas, aprovada: estaAprovado(estrelas) };
}
