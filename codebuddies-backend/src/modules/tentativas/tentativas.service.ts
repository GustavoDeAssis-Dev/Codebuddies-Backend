import type { Desafio, Tentativa } from '../../domain/entidades.js';
import { corrigirFase } from '../../domain/regras/correcao.js';
import { avaliarDesempenho } from '../../domain/regras/estrelas.js';
import { montarMapaDeFases, podeJogar, proximaFase } from '../../domain/regras/progressao.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { listarFasesJogaveis } from '../conteudo/fases-jogaveis.js';
import { JogoService } from '../jogo/jogo.service.js';
import { registrarTentativaSchema, type RegistrarTentativaInput } from './tentativas.schemas.js';
import { novasConquistas, type Conquista } from '../../domain/regras/conquistas.js';
import { RecompensasService } from '../recompensas/recompensas.service.js';
/** ✓ ou ✗ de cada desafio — sem revelar a resposta correta. */
export interface ResultadoDesafio {
  desafioId: number;
  ordem: number;
  acertou: boolean;
  pontos: number;
}

export interface ResultadoTentativa {
  tentativa: Tentativa;
  estrelas: number; // RN09 / RN12 — mostrado imediatamente na tela de resultado
  percentual: number;
  pontos: number; // soma dos pontos dos desafios acertados
  pontosPossiveis: number;
  acertos: number;
  erros: number;
  desafios: ResultadoDesafio[];
  aprovada: boolean; // true → tela de sucesso (RF-P11); false → tela de derrota (RF-P12)
  melhorEstrelas: number; // melhor resultado da fase até agora (RN06)
  novoRecorde: boolean; // superou o melhor resultado anterior (CA07)
  proximaFaseId: number | null; // fase liberada para "Avançar" (null se não aprovou ou era a última)
  nivelAtual: number;
  estrelasTotais: number;
  novasConquistas: Conquista[]; // Etapa 8 — medalhas ganhas NESTA jogada (vazio se nenhuma)
}

export class TentativasService {
  private readonly jogo: JogoService;
  private readonly recompensas: RecompensasService;

  constructor(private readonly ctx: Contexto) {
    this.jogo = new JogoService(ctx);
    this.recompensas = new RecompensasService(ctx);
  }
  /**
   * RF-P07 / RF-P10 / RF-A03 / RN05 / RN06 / RN07 / RN12–RN15 / CA04–CA07 — Etapa 7
   *
   * Registra o fim de uma fase:
   *  1. confere aula aberta, aluno ativo e na aula, fase liberada e com desafios
   *  2. CORRIGE cada resposta no back-end (ignora maiúsculas, acentos e espaços)
   *  3. estrelas pela % de acertos; pontos = soma dos pontos dos desafios acertados
   *  4. grava a tentativa + uma resposta por desafio numa TRANSAÇÃO (ou tudo, ou nada)
   *  5. o PROGRESSO é atualizado pela trigger do Oracle (ou pela versão em memória, nos testes)
   */
  async registrar(alunoId: number, input: RegistrarTentativaInput): Promise<ResultadoTentativa> {
    const { sessao } = await this.jogo.exigirAlunoNaAula(alunoId);
    const dados = registrarTentativaSchema.parse(input);
    const { repos, agora } = this.ctx;

    const fase = await repos.conteudo.buscarFase(dados.faseId);
    if (!fase) throw Erros.faseNaoEncontrada();

    const desafios = await repos.conteudo.listarDesafios(fase.id);
    if (desafios.length === 0) throw Erros.faseSemDesafios();

    const fases = await listarFasesJogaveis(repos); // só fases com desafios (as "em construção" não travam)
    const mapaAntes = montarMapaDeFases(fases, await repos.progressos.listarPorAluno(alunoId));
    if (!podeJogar(mapaAntes, fase.id)) throw Erros.faseBloqueada();
    this.validarRespostas(desafios, dados.respostas);

    // Correção → estrelas e pontos
    const correcao = corrigirFase(desafios, dados.respostas);
    const { percentual, estrelas, aprovada } = avaliarDesempenho(correcao.acertos, correcao.erros);
    const anterior = await repos.progressos.buscar(alunoId, fase.id);
    const conquistasAntes = await this.recompensas.conquistasDoAluno(alunoId);

    // Tentativa + respostas juntas: se uma resposta falhar ao gravar, a tentativa também é desfeita
    const tentativa = await repos.transacao(async (r) => {
      const t = await r.tentativas.criar({
        alunoId,
        faseId: fase.id,
        sessaoId: sessao.id,
        percentual,
        estrelas,
        pontos: correcao.pontos,
        aprovada,
        tempoSegundos: dados.tempoSegundos,
        dataHora: agora(),
      });
      await r.respostas.registrar(
        t.id,
        correcao.itens.map((i) => ({
          desafioId: i.desafioId,
          respostaSubmetida: i.respostaSubmetida || null, // "" (em branco) é gravado como pulado
          acertou: i.acertou,
        })),
      );
      return t;
    });

    // Lê o progresso já consolidado (RN06 / RN15)
    const progressos = await repos.progressos.listarPorAluno(alunoId);
    const atual = progressos.find((p) => p.faseId === fase.id);
    const mapaDepois = montarMapaDeFases(fases, progressos);
    const proxima = aprovada ? proximaFase(mapaDepois, fase.id) : null; // RN13 / RN14
    const ordemDe = new Map(desafios.map((d) => [d.id, d.ordem]));
    const conquistasDepois = await this.recompensas.conquistasDoAluno(alunoId);

    return {
      tentativa,
      estrelas,
      percentual,
      pontos: correcao.pontos,
      pontosPossiveis: correcao.pontosPossiveis,
      acertos: correcao.acertos,
      erros: correcao.erros,
      desafios: correcao.itens.map((i) => ({
        desafioId: i.desafioId,
        ordem: ordemDe.get(i.desafioId)!,
        acertou: i.acertou,
        pontos: i.pontos,
      })),
      aprovada,
      melhorEstrelas: atual?.melhorEstrelas ?? estrelas,
      novoRecorde: anterior === null || estrelas > anterior.melhorEstrelas,
      proximaFaseId: proxima?.faseId ?? null,
      nivelAtual: mapaDepois.nivelAtual,
      estrelasTotais: mapaDepois.estrelasTotais,
      novasConquistas: novasConquistas(conquistasAntes, conquistasDepois),
    };
  }

  /** Cada resposta precisa ser de um desafio DESTA fase, e cada desafio só pode ser respondido uma vez. */
  private validarRespostas(desafios: Desafio[], respostas: { desafioId: number }[]) {
    const daFase = new Set(desafios.map((d) => d.id));
    const vistos = new Set<number>();
    for (const r of respostas) {
      if (!daFase.has(r.desafioId)) throw Erros.desafioForaDaFase();
      if (vistos.has(r.desafioId)) throw Erros.respostaDuplicada();
      vistos.add(r.desafioId);
    }
  }
}