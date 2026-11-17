import type { FaseComNivel } from '../../domain/entidades.js';
import type { Repositorios } from '../../repositories/contratos.js';

/**
 * Fases que o ALUNO enxerga: só as que têm pelo menos 1 desafio.
 *
 * Uma fase "em construção" (cadastrada pelo professor, mas ainda sem desafios) não pode
 * aparecer no mapa nem entrar na progressão: o aluno não conseguiria concluí-la e todas as
 * fases depois dela ficariam bloqueadas para sempre.
 * O professor continua vendo todas as fases em /api/fases (com `totalDesafios`).
 */
export async function listarFasesJogaveis(repos: Repositorios): Promise<FaseComNivel[]> {
  const [fases, totais] = await Promise.all([
    repos.conteudo.listarFases(),
    repos.conteudo.contarDesafiosPorFase(),
  ]);
  return fases.filter((f) => (totais.get(f.id) ?? 0) > 0);
}
