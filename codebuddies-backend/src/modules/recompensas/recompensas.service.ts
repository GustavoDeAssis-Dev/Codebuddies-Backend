import { calcularConquistas, type Conquista } from '../../domain/regras/conquistas.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { listarFasesJogaveis } from '../conteudo/fases-jogaveis.js';

/** O "painel de recompensas" do aluno: pontuação, estrelas e medalhas. */
export interface PainelDeRecompensas {
  estrelasTotais: number; // soma das melhores estrelas de cada fase
  pontosTotais: number; // soma da melhor pontuação de cada fase
  fasesConcluidas: number;
  totalFases: number;
  totalConquistadas: number;
  conquistas: Conquista[]; // as 6, ganhas e bloqueadas (o front mostra o "cadeado")
}

/** Etapa 8 — Pontuação, estrelas e recompensas. */
export class RecompensasService {
  constructor(private readonly ctx: Contexto) {}

  /** Busca os dados do aluno no banco (as 3 consultas ao mesmo tempo). */
  private async dadosDoAluno(alunoId: number) {
    const { progressos, tentativas } = this.ctx.repos;
    const [fases, progressosDoAluno, tentativasDoAluno] = await Promise.all([
      listarFasesJogaveis(this.ctx.repos),
      progressos.listarPorAluno(alunoId),
      tentativas.listarPorAluno(alunoId),
    ]);
    return { fases, progressos: progressosDoAluno, tentativas: tentativasDoAluno };
  }

  /** Só as conquistas (usado pelo registro de tentativa para descobrir as medalhas novas). */
  async conquistasDoAluno(alunoId: number): Promise<Conquista[]> {
    return calcularConquistas(await this.dadosDoAluno(alunoId));
  }

  async painel(alunoId: number): Promise<PainelDeRecompensas> {
    const aluno = await this.ctx.repos.alunos.buscarPorId(alunoId);
    if (!aluno) throw Erros.alunoNaoEncontrado();

    const dados = await this.dadosDoAluno(alunoId);
    const idsDasFases = new Set(dados.fases.map((f) => f.id));
    const validos = dados.progressos.filter((p) => idsDasFases.has(p.faseId));
    const conquistas = calcularConquistas(dados);

    return {
      estrelasTotais: validos.reduce((soma, p) => soma + p.melhorEstrelas, 0),
      pontosTotais: validos.reduce((soma, p) => soma + p.pontuacaoMaxima, 0),
      fasesConcluidas: validos.filter((p) => p.concluida).length,
      totalFases: dados.fases.length,
      totalConquistadas: conquistas.filter((c) => c.conquistada).length,
      conquistas,
    };
  }
}