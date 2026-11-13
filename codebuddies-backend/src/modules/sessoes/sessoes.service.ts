import type { RankingFinal, Sessao, StatusSessao } from '../../domain/entidades.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { RankingService } from '../ranking/ranking.service.js';

/**
 * RF-D02 a RF-D06 / RN01 / RN02 — Ciclo de vida da aula (sessão):
 *   criar (CRIADA) → abrir (ABERTA) → encerrar (ENCERRADA, gera ranking congelado)
 *
 * As checagens abaixo dão mensagens claras ao front. No Oracle, as procedures
 * PRC_ABRIR_SESSAO / PRC_ENCERRAR_SESSAO e o índice UX_SESSAO_ABERTA garantem as
 * mesmas regras mesmo com dois cliques ao mesmo tempo.
 */
export class SessoesService {
  constructor(private readonly ctx: Contexto) {}

  async criar(turmaId: number, professorId: number): Promise<Sessao> {
    const turma = await this.ctx.repos.turmas.buscarPorId(turmaId);
    if (!turma || !turma.ativa) throw Erros.turmaNaoEncontrada();
    return this.ctx.repos.sessoes.criar({ turmaId, professorId, criadaEm: this.ctx.agora() });
  }

  async abrir(sessaoId: number): Promise<Sessao> {
    const sessao = await this.buscar(sessaoId);
    if (sessao.status === 'ABERTA') throw Erros.sessaoJaAberta();
    if (sessao.status === 'ENCERRADA') throw Erros.sessaoJaEncerrada();

    // RN01 — apenas uma sessão aberta por vez
    if (await this.ctx.repos.sessoes.buscarAberta()) throw Erros.outraSessaoAberta();

    return this.ctx.repos.sessoes.abrir(sessaoId, this.ctx.agora());
  }

  /** RF-D04 / RF-D05 / CA09 — encerra, bloqueia novas entradas e congela o ranking. */
  async encerrar(sessaoId: number): Promise<{ sessao: Sessao; ranking: RankingFinal }> {
    const sessao = await this.buscar(sessaoId);
    if (sessao.status === 'ENCERRADA') throw Erros.sessaoJaEncerrada();
    if (sessao.status !== 'ABERTA') throw Erros.sessaoNaoEstaAberta();

    // Encerrar + salvar o ranking numa TRANSAÇÃO: se o ranking falhar, a aula continua aberta
    return this.ctx.repos.transacao(async (repos) => {
      const encerrada = await repos.sessoes.encerrar(sessaoId, this.ctx.agora());
      const ranking = await new RankingService({ ...this.ctx, repos }).gerar(sessaoId);
      return { sessao: encerrada, ranking };
    });
  }

  /** Sessão aberta no momento (ou null → front mostra "Aguardando professor iniciar a aula"). */
  async obterAberta(): Promise<Sessao | null> {
    return this.ctx.repos.sessoes.buscarAberta();
  }

  /** RN02 — usada pelos outros módulos: exige sessão aberta. */
  async exigirAberta(): Promise<Sessao> {
    const sessao = await this.obterAberta();
    if (!sessao) throw Erros.sessaoFechada();
    return sessao;
  }

  /** Etapa 4 — lista as aulas, da mais recente para a mais antiga (filtros opcionais). */
  async listar(filtro: { turmaId?: number; status?: StatusSessao } = {}): Promise<Sessao[]> {
    const sessoes = await this.ctx.repos.sessoes.listar(filtro);
    return sessoes.sort((a, b) => b.criadaEm.getTime() - a.criadaEm.getTime() || b.id - a.id);
  }

  /** Etapa 4 — o que a tela do aluno precisa saber: tem aula aberta? de qual turma? (CA01) */
  async resumoAberta() {
    const sessao = await this.obterAberta();
    if (!sessao) return { aberta: false as const };
    const turma = await this.ctx.repos.turmas.buscarPorId(sessao.turmaId);
    return {
      aberta: true as const,
      sessao: {
        id: sessao.id,
        turmaId: sessao.turmaId,
        turmaNome: turma?.nome ?? '',
        inicio: sessao.dataHoraInicio,
      },
    };
  }

  async buscar(id: number): Promise<Sessao> {
    const sessao = await this.ctx.repos.sessoes.buscarPorId(id);
    if (!sessao) throw Erros.sessaoNaoEncontrada();
    return sessao;
  }
}