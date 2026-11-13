import type { Tentativa } from '../../domain/entidades.js';
import { avaliarDesempenho } from '../../domain/regras/estrelas.js';
import { montarMapaDeFases, podeJogar, proximaFase } from '../../domain/regras/progressao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { SessoesService } from '../sessoes/sessoes.service.js';
import { registrarTentativaSchema, type RegistrarTentativaInput } from './tentativas.schemas.js';

export interface ResultadoTentativa {
  tentativa: Tentativa;
  estrelas: number; // RN09 / RN12 — mostrado imediatamente na tela de resultado
  percentual: number;
  pontos: number;
  aprovada: boolean; // true → tela de sucesso (RF-P11); false → tela de derrota (RF-P12)
  melhorEstrelas: number; // melhor resultado da fase até agora (RN06)
  novoRecorde: boolean; // superou o melhor resultado anterior (CA07)
  proximaFaseId: number | null; // fase liberada para "Avançar" (null se não aprovou ou era a última)
  nivelAtual: number;
  estrelasTotais: number;
}

export class TentativasService {
  private readonly sessoes: SessoesService;

  constructor(private readonly ctx: Contexto) {
    this.sessoes = new SessoesService(ctx);
  }

  /**
   * RF-P07 / RF-P10 / RF-A03 / RN05 / RN06 / RN07 / RN12–RN15 / CA04–CA07
   *
   * Registra o fim de uma fase:
   *  - exige sessão aberta, aluno ativo e participante da sessão
   *  - exige que a fase esteja liberada para o aluno
   *  - calcula estrelas (pela % de acertos) e pontos (100 por acerto)
   *  - grava a tentativa; o PROGRESSO (melhor resultado) é atualizado automaticamente
   *    pela trigger do Oracle (ou pela versão em memória, nos testes)
   */
  async registrar(alunoId: number, input: RegistrarTentativaInput): Promise<ResultadoTentativa> {
    const sessao = await this.sessoes.exigirAberta();
    const dados = registrarTentativaSchema.parse(input);
    const { repos, agora } = this.ctx;

    const aluno = await repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();
    if (aluno.status === 'DESATIVADO') throw Erros.alunoDesativado();
    if (!(await repos.participacoes.existe(sessao.id, alunoId))) throw Erros.alunoForaDaSessao();

    const fase = await repos.conteudo.buscarFase(dados.faseId);
    if (!fase) throw Erros.faseNaoEncontrada();

    const fases = await repos.conteudo.listarFases();
    const mapaAntes = montarMapaDeFases(fases, await repos.progressos.listarPorAluno(alunoId));
    if (!podeJogar(mapaAntes, fase.id)) throw Erros.faseBloqueada();

    const anterior = await repos.progressos.buscar(alunoId, fase.id);

    // Cálculo da nota → estrelas e pontos
    const { percentual, estrelas, aprovada, pontos } = avaliarDesempenho(dados.acertos, dados.erros);

    const tentativa = await repos.tentativas.criar({
      alunoId,
      faseId: fase.id,
      sessaoId: sessao.id,
      percentual,
      estrelas,
      pontos,
      aprovada,
      tempoSegundos: dados.tempoSegundos,
      dataHora: agora(),
    });

    // Lê o progresso já consolidado (RN06 / RN15)
    const progressos = await repos.progressos.listarPorAluno(alunoId);
    const atual = progressos.find((p) => p.faseId === fase.id);
    const mapaDepois = montarMapaDeFases(fases, progressos);
    const proxima = aprovada ? proximaFase(mapaDepois, fase.id) : null; // RN13 / RN14

    return {
      tentativa,
      estrelas,
      percentual,
      pontos,
      aprovada,
      melhorEstrelas: atual?.melhorEstrelas ?? estrelas,
      novoRecorde: anterior === null || estrelas > anterior.melhorEstrelas,
      proximaFaseId: proxima?.faseId ?? null,
      nivelAtual: mapaDepois.nivelAtual,
      estrelasTotais: mapaDepois.estrelasTotais,
    };
  }
}