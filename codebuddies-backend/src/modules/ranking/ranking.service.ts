import type { RankingFinal, Tentativa } from '../../domain/entidades.js';
import { estaAprovado } from '../../domain/regras/estrelas.js';
import { montarMapaDeFases } from '../../domain/regras/progressao.js';
import { montarRanking, type DadosRanking } from '../../domain/regras/ranking.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';

/**
 * RF-P13 / RF-P14 / RF-D12 / RN08 / CA08 / CA09
 * O ranking é calculado UMA vez, no encerramento da sessão, e fica congelado.
 */
export class RankingService {
  constructor(private readonly ctx: Contexto) {}

  /** Calcula e salva o ranking final. Chamado pelo SessoesService ao encerrar a aula. */
  async gerar(sessaoId: number): Promise<RankingFinal> {
    const { repos } = this.ctx;
    const [participacoes, tentativas, fases] = await Promise.all([
      repos.participacoes.listarPorSessao(sessaoId),
      repos.tentativas.listarPorSessao(sessaoId),
      repos.conteudo.listarFases(),
    ]);

    const dados: DadosRanking[] = [];
    for (const participacao of participacoes) {
      const aluno = await repos.alunos.buscarPorId(participacao.alunoId);
      if (!aluno || aluno.status === 'DESATIVADO') continue; // RN10: desativado sai da lista visível

      const mapa = montarMapaDeFases(fases, await repos.progressos.listarPorAluno(aluno.id));
      const daSessao = melhoresDaSessao(tentativas.filter((t) => t.alunoId === aluno.id));

      dados.push({
        alunoId: aluno.id,
        nome: aluno.nome,
        nivelAlcancado: mapa.nivelAtual,
        estrelasNaSessao: daSessao.reduce((s, t) => s + t.estrelas, 0),
        fasesConcluidasNaSessao: daSessao.filter((t) => estaAprovado(t.estrelas)).length,
        tempoTotalSegundos: daSessao.reduce((s, t) => s + t.tempoSegundos, 0),
      });
    }

    const ranking: RankingFinal = { sessaoId, geradoEm: this.ctx.agora(), itens: montarRanking(dados) };
    await repos.rankings.salvar(ranking);
    return ranking;
  }

  /** Ranking só pode ser visto depois que a sessão foi encerrada (RN08). */
  async obter(sessaoId: number): Promise<RankingFinal> {
    const sessao = await this.ctx.repos.sessoes.buscarPorId(sessaoId);
    if (!sessao) throw Erros.sessaoNaoEncontrada();
    if (sessao.status !== 'ENCERRADA') throw Erros.rankingIndisponivel();

    return (await this.ctx.repos.rankings.buscarPorSessao(sessaoId)) ?? this.gerar(sessaoId);
  }
}

/** Melhor tentativa (mais estrelas; empate → menor tempo) de cada fase jogada na sessão. */
function melhoresDaSessao(tentativas: Tentativa[]): Tentativa[] {
  const melhor = new Map<number, Tentativa>();
  for (const t of tentativas) {
    const atual = melhor.get(t.faseId);
    if (
      !atual ||
      t.estrelas > atual.estrelas ||
      (t.estrelas === atual.estrelas && t.tempoSegundos < atual.tempoSegundos)
    ) {
      melhor.set(t.faseId, t);
    }
  }
  return [...melhor.values()];
}
