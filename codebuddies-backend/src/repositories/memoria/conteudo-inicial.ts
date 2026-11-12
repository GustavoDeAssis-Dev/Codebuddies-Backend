import type { FaseComNivel, Nivel } from '../../domain/entidades.js';

/**
 * Conteúdo de exemplo (níveis e fases) para desenvolvimento.
 * O conteúdo real será definido pela equipe e cadastrado no banco.
 */
export function conteudoInicial(): { niveis: Nivel[]; fases: FaseComNivel[] } {
  const niveis: Nivel[] = [
    { id: 1, ordem: 1, titulo: 'Conhecendo o computador', descricao: null },
    { id: 2, ordem: 2, titulo: 'Primeiras letras', descricao: null },
    { id: 3, ordem: 3, titulo: 'Pensando com lógica', descricao: null },
  ];

  const base = [
    { id: 1, nivelId: 1, ordem: 1, titulo: 'Clique nos balões', tipo: 'COMPUTACAO_BASICA'},
    { id: 2, nivelId: 1, ordem: 2, titulo: 'Encontre as teclas', tipo: 'COMPUTACAO_BASICA'},
    { id: 3, nivelId: 2, ordem: 1, titulo: 'Vogais', tipo: 'DIGITACAO'},
    { id: 4, nivelId: 2, ordem: 2, titulo: 'Palavras curtas', tipo: 'DIGITACAO'},
    { id: 5, nivelId: 3, ordem: 1, titulo: 'Complete a sequência', tipo: 'LOGICA'},
    { id: 6, nivelId: 3, ordem: 2, titulo: 'Se chover, então...', tipo: 'LOGICA'},
  ] as const;

  const fases: FaseComNivel[] = base.map((f) => ({
    ...f,
    ativa: true,
    nivel: niveis.find((n) => n.id === f.nivelId)!,
  }));

  return { niveis, fases };
}
