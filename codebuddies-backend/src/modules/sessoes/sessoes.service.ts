import type { RankingFinal, Sessao } from '../../domain/entidades.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { RankingService } from '../ranking/ranking.service.js';

/**
 * RF-D02 a RF-D06 / RN01 / RN02 — Ciclo de vida da aula (sessão):
 *   criar (AGUARDANDO) → abrir (ABERTA) → encerrar (ENCERRADA, gera ranking congelado)
 */
export class SessoesService {
  private readonly ranking: RankingService;

  constructor(private readonly ctx: Contexto) {
    this.ranking = new RankingService(ctx);
  }

  async criar(turmaId: number): Promise<Sessao> {
    const turma = await this.ctx.repos.turmas.buscarPorId(turmaId);
    if (!turma || !turma.ativa) throw Erros.turmaNaoEncontrada();
    return this.ctx.repos.sessoes.criar({ turmaId, criadaEm: this.ctx.agora() });
  }

  async abrir(sessaoId: number): Promise<Sessao> {
    const sessao = await this.buscar(sessaoId);
    if (sessao.status === 'ABERTA') throw Erros.sessaoJaAberta();
    if (sessao.status === 'ENCERRADA') throw Erros.sessaoJaEncerrada();

    // RN01 — apenas uma sessão aberta por vez
    if (await this.ctx.repos.sessoes.buscarAberta()) throw Erros.outraSessaoAberta();

    return this.ctx.repos.sessoes.atualizar({
      ...sessao,
      status: 'ABERTA',
      dataHoraInicio: this.ctx.agora(),
    });
  }

  /** RF-D04 / RF-D05 / CA09 — encerra, bloqueia novas entradas e congela o ranking. */
  async encerrar(sessaoId: number): Promise<{ sessao: Sessao; ranking: RankingFinal }> {
    const sessao = await this.buscar(sessaoId);
    if (sessao.status === 'ENCERRADA') throw Erros.sessaoJaEncerrada();
    if (sessao.status !== 'ABERTA') throw Erros.sessaoNaoEstaAberta();

    const encerrada = await this.ctx.repos.sessoes.atualizar({
      ...sessao,
      status: 'ENCERRADA',
      dataHoraFim: this.ctx.agora(),
    });
    const ranking = await this.ranking.gerar(sessaoId);
    return { sessao: encerrada, ranking };
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

  private async buscar(id: number): Promise<Sessao> {
    const sessao = await this.ctx.repos.sessoes.buscarPorId(id);
    if (!sessao) throw Erros.sessaoNaoEncontrada();
    return sessao;
  }
}
