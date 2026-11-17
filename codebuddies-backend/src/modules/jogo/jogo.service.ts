import type { Aluno, DesafioParaAluno, Nivel, Sessao } from '../../domain/entidades.js';
import { podeJogar } from '../../domain/regras/progressao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { ProgressoService } from '../progresso/progresso.service.js';
import { SessoesService } from '../sessoes/sessoes.service.js';

export interface FaseParaJogar {
  fase: { id: number; titulo: string; tipo: string; ordem: number; nivel: Nivel };
  desafios: DesafioParaAluno[]; // SEM a resposta correta
  totalDesafios: number;
  pontosPossiveis: number;
}

/**
 * Etapa 6 — o que o ALUNO vê do conteúdo: o mapa de fases e os desafios da fase escolhida.
 * A resposta correta NUNCA sai do back-end: a correção será feita aqui (Etapa 7).
 */
export class JogoService {
  private readonly sessoes: SessoesService;
  private readonly progresso: ProgressoService;

  constructor(private readonly ctx: Contexto) {
    this.sessoes = new SessoesService(ctx);
    this.progresso = new ProgressoService(ctx);
  }

  /**
   * Confere se o aluno pode jogar AGORA: aula aberta (CA01), aluno ativo (RN10)
   * e participante da aula aberta. Será reutilizado pelas tentativas na Etapa 7.
   */
  async exigirAlunoNaAula(alunoId: number): Promise<{ aluno: Aluno; sessao: Sessao }> {
    const sessao = await this.sessoes.exigirAberta();
    const aluno = await this.ctx.repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();
    if (aluno.status === 'DESATIVADO') throw Erros.alunoDesativado();
    if (!(await this.ctx.repos.participacoes.existe(sessao.id, alunoId))) throw Erros.alunoForaDaSessao();
    return { aluno, sessao };
  }

  /** RF-P04 / RF-P05 — mapa de fases do aluno logado. */
  async mapa(alunoId: number) {
    const aluno = await this.ctx.repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();
    if (aluno.status === 'DESATIVADO') throw Erros.alunoDesativado();
    return this.progresso.mapaDoAluno(alunoId);
  }

  /** Abre uma fase para jogar: exige fase liberada (RN07 / RN13) e com desafios cadastrados. */
  async abrirFase(alunoId: number, faseId: number): Promise<FaseParaJogar> {
    await this.exigirAlunoNaAula(alunoId);
    const { conteudo } = this.ctx.repos;

    const fase = await conteudo.buscarFase(faseId);
    if (!fase) throw Erros.faseNaoEncontrada();

    // Fase sem desafios fica fora do mapa do aluno: avisa antes de checar o bloqueio
    const [nivel, desafios] = await Promise.all([
      conteudo.buscarNivel(fase.nivelId),
      conteudo.listarDesafios(faseId),
    ]);
    if (desafios.length === 0) throw Erros.faseSemDesafios();

    const mapa = await this.progresso.mapaDoAluno(alunoId);
    if (!podeJogar(mapa, faseId)) throw Erros.faseBloqueada();

    return {
      fase: { id: fase.id, titulo: fase.titulo, tipo: fase.tipo, ordem: fase.ordem, nivel: nivel! },
      // Monta o objeto campo a campo: assim a resposta correta não vaza nem por engano
      desafios: desafios.map((d) => ({
        id: d.id,
        faseId: d.faseId,
        ordem: d.ordem,
        enunciado: d.enunciado,
        pontos: d.pontos,
      })),
      totalDesafios: desafios.length,
      pontosPossiveis: desafios.reduce((soma, d) => soma + d.pontos, 0),
    };
  }
}