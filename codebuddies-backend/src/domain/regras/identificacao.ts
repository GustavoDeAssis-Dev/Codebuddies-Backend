/**
 * RN03 / RN04 — Identificação do aluno por nome + idade.
 *
 * Crianças digitam de jeitos diferentes; para reconhecer o mesmo aluno:
 *   "  João   Pedro " → nome exibido "João Pedro", chave "joao pedro"
 * (sem acentos, minúsculas, espaços únicos).
 */

export const IDADE_MINIMA = 3;
export const IDADE_MAXIMA = 14;
export const NOME_TAMANHO_MAXIMO = 40;

export function limparNome(nome: string): string {
  return nome.trim().replace(/\s+/g, ' ');
}

export function normalizarNome(nome: string): string {
  const semAcentos = limparNome(nome).normalize('NFD').replace(/\p{M}/gu, ''); // \p{M} = marcas de acento
  return semAcentos.toLocaleLowerCase('pt-BR');
}
