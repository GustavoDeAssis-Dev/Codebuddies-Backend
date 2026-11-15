import type { FaseComNivel, Progresso, Tentativa } from '../entidades.js';

/**
 * Etapa 8 — Recompensas: conquistas (medalhas) do aluno.
 *
 * São CALCULADAS a partir do progresso e das tentativas (não ficam gravadas no banco):
 * assim nunca ficam desatualizadas e não exigem tabela nova.
 */

/** Estrelas necessárias para a conquista "Colecionador". */
export const META_ESTRELAS = 15;

/** Catálogo: a ordem aqui é a ordem em que aparecem na tela. */
export const CONQUISTAS = [
  { codigo: 'PRIMEIRA_FASE', icone: '🌟', titulo: 'Primeira estrela', descricao: 'Concluiu a primeira fase.' },
  { codigo: 'PERFEITO', icone: '🏆', titulo: 'Perfeito!', descricao: 'Tirou 5 estrelas em uma fase.' },
  {
    codigo: 'NAO_DESISTIU',
    icone: '💪',
    titulo: 'Não desistiu',
    descricao: 'Jogou uma fase de novo e melhorou o resultado.',
  },
  { codigo: 'SUBIU_DE_NIVEL', icone: '🚀', titulo: 'Subiu de nível', descricao: 'Concluiu todas as fases de um nível.' },
  {
    codigo: 'COLECIONADOR',
    icone: '⭐',
    titulo: 'Colecionador de estrelas',
    descricao: `Juntou ${META_ESTRELAS} estrelas.`,
  },
  { codigo: 'MESTRE', icone: '👑', titulo: 'Mestre CodeBuddies', descricao: 'Concluiu todas as fases do jogo.' },
] as const;

export type CodigoConquista = (typeof CONQUISTAS)[number]['codigo'];

export interface Conquista {
  codigo: CodigoConquista;
  icone: string;
  titulo: string;
  descricao: string;
  conquistada: boolean;
}

export interface DadosConquistas {
  fases: FaseComNivel[]; // todas as fases do jogo
  progressos: Progresso[]; // melhor resultado do aluno em cada fase
  tentativas: Tentativa[]; // todas as jogadas do aluno
}

/** true se, em alguma fase, uma tentativa teve MAIS estrelas que todas as anteriores dela. */
function melhorouAlgumaVez(tentativas: Tentativa[]): boolean {
  const melhorPorFase = new Map<number, number>();
  const emOrdem = [...tentativas].sort((a, b) => a.dataHora.getTime() - b.dataHora.getTime() || a.id - b.id);

  for (const t of emOrdem) {
    const melhorAteAqui = melhorPorFase.get(t.faseId);
    if (melhorAteAqui !== undefined && t.estrelas > melhorAteAqui) return true;
    melhorPorFase.set(t.faseId, Math.max(melhorAteAqui ?? 0, t.estrelas));
  }
  return false;
}

/** Calcula as 6 conquistas do aluno, marcando quais ele já ganhou. */
export function calcularConquistas({ fases, progressos, tentativas }: DadosConquistas): Conquista[] {
  // Só conta progresso de fases que ainda existem (o professor pode ter removido alguma)
  const idsDasFases = new Set(fases.map((f) => f.id));
  const validos = progressos.filter((p) => idsDasFases.has(p.faseId));
  const concluidas = new Set(validos.filter((p) => p.concluida).map((p) => p.faseId));
  const estrelasTotais = validos.reduce((soma, p) => soma + p.melhorEstrelas, 0);

  // Agrupa as fases por nível: Map<nivelId, faseIds[]>
  const fasesPorNivel = new Map<number, number[]>();
  for (const f of fases) fasesPorNivel.set(f.nivelId, [...(fasesPorNivel.get(f.nivelId) ?? []), f.id]);

  const ganhou: Record<CodigoConquista, boolean> = {
    PRIMEIRA_FASE: concluidas.size >= 1,
    PERFEITO: validos.some((p) => p.melhorEstrelas === 5),
    NAO_DESISTIU: melhorouAlgumaVez(tentativas),
    SUBIU_DE_NIVEL: [...fasesPorNivel.values()].some((ids) => ids.every((id) => concluidas.has(id))),
    COLECIONADOR: estrelasTotais >= META_ESTRELAS,
    MESTRE: fases.length > 0 && fases.every((f) => concluidas.has(f.id)),
  };

  return CONQUISTAS.map((c) => ({ ...c, conquistada: ganhou[c.codigo] }));
}

/** As conquistas que o aluno tem AGORA e não tinha ANTES (para a tela "🎉 Você ganhou..."). */
export function novasConquistas(antes: Conquista[], depois: Conquista[]): Conquista[] {
  const jaTinha = new Set(antes.filter((c) => c.conquistada).map((c) => c.codigo));
  return depois.filter((c) => c.conquistada && !jaTinha.has(c.codigo));
}