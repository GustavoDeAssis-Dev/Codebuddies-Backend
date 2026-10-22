import type { FaseComNivel, Progresso } from '../entidades.js';
import { estaAprovado } from './estrelas.js';

/**
 * RF-P04 / RF-P05 / RF-P06 / RN07 / RN11 / RN13 — Mapa de fases e desbloqueio sequencial.
 *
 * - As fases seguem a ordem: nível 1 (fase 1, 2, ...), nível 2 (fase 1, 2, ...), ...
 * - A primeira fase está sempre liberada.
 * - Uma fase só é liberada se a ANTERIOR estiver concluída (melhor resultado >= 3 estrelas).
 * - Fase concluída continua jogável (para melhorar as estrelas — RN06).
 */

export type StatusFase = 'BLOQUEADA' | 'LIBERADA' | 'CONCLUIDA';

export interface FaseNoMapa {
  faseId: number;
  titulo: string;
  tipo: FaseComNivel['tipo'];
  nivelId: number;
  nivelOrdem: number;
  nivelTitulo: string;
  ordem: number;
  status: StatusFase;
  melhorEstrelas: number;
  tentativas: number;
}

export interface MapaDeFases {
  fases: FaseNoMapa[];
  nivelAtual: number; // ordem do nível onde está a primeira fase não concluída
  estrelasTotais: number; // soma das melhores estrelas de cada fase (RN15)
  fasesConcluidas: number;
  todasConcluidas: boolean;
}

export function ordenarFases<T extends FaseComNivel>(fases: T[]): T[] {
  return fases
    .filter((f) => f.ativa)
    .sort((a, b) => a.nivel.ordem - b.nivel.ordem || a.ordem - b.ordem || a.id - b.id);
}

export function montarMapaDeFases(fases: FaseComNivel[], progressos: Progresso[]): MapaDeFases {
  const porFase = new Map(progressos.map((p) => [p.faseId, p]));
  const ordenadas = ordenarFases(fases);

  let anteriorConcluida = true; // a primeira fase sempre começa liberada
  const mapa: FaseNoMapa[] = ordenadas.map((fase) => {
    const progresso = porFase.get(fase.id);
    const melhorEstrelas = progresso?.melhorEstrelas ?? 0;
    const concluida = progresso !== undefined && estaAprovado(melhorEstrelas);
    const status: StatusFase = concluida ? 'CONCLUIDA' : anteriorConcluida ? 'LIBERADA' : 'BLOQUEADA';
    anteriorConcluida = concluida;
    return {
      faseId: fase.id,
      titulo: fase.titulo,
      tipo: fase.tipo,
      nivelId: fase.nivelId,
      nivelOrdem: fase.nivel.ordem,
      nivelTitulo: fase.nivel.titulo,
      ordem: fase.ordem,
      status,
      melhorEstrelas,
      tentativas: progresso?.tentativas ?? 0,
    };
  });

  const primeiraPendente = mapa.find((f) => f.status !== 'CONCLUIDA');
  const ultima = mapa.at(-1);

  return {
    fases: mapa,
    nivelAtual: primeiraPendente?.nivelOrdem ?? ultima?.nivelOrdem ?? 1,
    estrelasTotais: mapa.reduce((soma, f) => soma + f.melhorEstrelas, 0),
    fasesConcluidas: mapa.filter((f) => f.status === 'CONCLUIDA').length,
    todasConcluidas: mapa.length > 0 && primeiraPendente === undefined,
  };
}

export function podeJogar(mapa: MapaDeFases, faseId: number): boolean {
  const fase = mapa.fases.find((f) => f.faseId === faseId);
  return fase !== undefined && fase.status !== 'BLOQUEADA';
}

/** Próxima fase depois de `faseId` (ou null se for a última). */
export function proximaFase(mapa: MapaDeFases, faseId: number): FaseNoMapa | null {
  const i = mapa.fases.findIndex((f) => f.faseId === faseId);
  return i >= 0 ? (mapa.fases[i + 1] ?? null) : null;
}
