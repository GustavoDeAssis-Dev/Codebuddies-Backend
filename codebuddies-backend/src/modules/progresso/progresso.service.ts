import { montarMapaDeFases, type MapaDeFases } from '../../domain/regras/progressao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { listarFasesJogaveis } from '../conteudo/fases-jogaveis.js';

/** RF-P04 / RF-P05 / RF-P06 / RF-P15 — mapa de fases com status, estrelas e nível atual do aluno. */
export class ProgressoService {
  constructor(private readonly ctx: Contexto) {}

  async mapaDoAluno(alunoId: number): Promise<MapaDeFases> {
    const aluno = await this.ctx.repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();

    const [fases, progressos] = await Promise.all([
      listarFasesJogaveis(this.ctx.repos), // só fases com desafios
      this.ctx.repos.progressos.listarPorAluno(alunoId),
    ]);
    return montarMapaDeFases(fases, progressos);
  }
}
