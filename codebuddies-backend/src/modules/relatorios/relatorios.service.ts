import type { TipoFase, Turma } from '../../domain/entidades.js';
import { ordenarFases } from '../../domain/regras/progressao.js';
import type { EstatisticasTentativas } from '../../repositories/contratos.js';
import type { Contexto } from '../../shared/contexto.js';
import { Erros } from '../../shared/errors/erros.js';
import { desafiosMaisErradosSchema, type DesafiosMaisErradosInput } from './relatorios.schemas.js';

/** Números prontos para a tela (arredondados, com taxa de aprovação). */
export interface Indicadores {
  totalTentativas: number;
  alunosQueJogaram: number;
  mediaEstrelas: number | null; // null = ninguém jogou ainda
  mediaPercentual: number | null;
  maiorPercentual: number | null;
  menorPercentual: number | null;
  pontosTotais: number;
  tempoMedioSegundos: number | null;
  taxaAprovacao: number | null; // % das tentativas com 3+ estrelas
}

export interface ResumoDaTurma extends Indicadores {
  turma: { id: number; nome: string };
  totalAlunos: number;
  alunosAtivos: number;
  totalAulas: number;
  aulasEncerradas: number;
}

export interface DesempenhoDaFase extends Indicadores {
  faseId: number;
  titulo: string;
  tipo: TipoFase;
  nivelOrdem: number;
  nivelTitulo: string;
  ordem: number;
}

/** PIVOT: alunos nas linhas × fases nas colunas. */
export interface Boletim {
  turma: { id: number; nome: string };
  fases: { faseId: number; titulo: string; nivelOrdem: number; ordem: number }[]; // cabeçalho das colunas
  linhas: {
    alunoId: number;
    nome: string;
    status: string;
    estrelas: (number | null)[]; // uma célula por fase, na ordem de `fases` (null = nunca jogou)
    totalEstrelas: number;
    fasesConcluidas: number;
  }[];
  mediaPorFase: (number | null)[]; // rodapé: média de estrelas de cada coluna
}

export interface DesafioComErros {
  desafioId: number;
  enunciado: string;
  respostaCorreta: string | null; // o PROFESSOR pode ver
  ordem: number | null;
  faseId: number | null;
  faseTitulo: string | null;
  respostas: number;
  erros: number;
  taxaErro: number; // %
}

const arredondar = (valor: number | null) => (valor === null ? null : Math.round(valor * 10) / 10);
const porcentagem = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : null);

const SEM_TENTATIVAS: EstatisticasTentativas = {
  totalTentativas: 0,
  alunosQueJogaram: 0,
  mediaEstrelas: null,
  mediaPercentual: null,
  maiorPercentual: null,
  menorPercentual: null,
  somaPontos: null,
  tempoMedioSegundos: null,
  aprovacoes: null,
};

/** Converte o resultado "cru" das agregações em indicadores prontos para o front. */
function indicadores(e: EstatisticasTentativas): Indicadores {
  return {
    totalTentativas: e.totalTentativas,
    alunosQueJogaram: e.alunosQueJogaram,
    mediaEstrelas: arredondar(e.mediaEstrelas),
    mediaPercentual: arredondar(e.mediaPercentual),
    maiorPercentual: e.maiorPercentual,
    menorPercentual: e.menorPercentual,
    pontosTotais: e.somaPontos ?? 0,
    tempoMedioSegundos: arredondar(e.tempoMedioSegundos),
    taxaAprovacao: porcentagem(e.aprovacoes ?? 0, e.totalTentativas),
  };
}

/** Etapa 9 — Relatórios do professor (dados para os painéis do front-end). */
export class RelatoriosService {
  constructor(private readonly ctx: Contexto) {}

  /** Visão geral da turma: COUNT, AVG, MAX, MIN e SUM das tentativas. */
  async resumo(turmaId: number): Promise<ResumoDaTurma> {
    const turma = await this.exigirTurma(turmaId);
    const { repos } = this.ctx;
    const [alunos, sessoes, estatisticas] = await Promise.all([
      repos.alunos.listarPorTurma(turmaId),
      repos.sessoes.listar({ turmaId }),
      repos.relatorios.estatisticasDaTurma(turmaId),
    ]);

    return {
      turma: { id: turma.id, nome: turma.nome },
      totalAlunos: alunos.length,
      alunosAtivos: alunos.filter((a) => a.status === 'ATIVO').length,
      totalAulas: sessoes.length,
      aulasEncerradas: sessoes.filter((s) => s.status === 'ENCERRADA').length,
      ...indicadores(estatisticas),
    };
  }

  /** As mesmas estatísticas para CADA fase (GROUP BY), incluindo as fases que ninguém jogou. */
  async desempenhoPorFase(turmaId: number): Promise<DesempenhoDaFase[]> {
    await this.exigirTurma(turmaId);
    const [fases, porFase] = await Promise.all([
      this.ctx.repos.conteudo.listarFases(),
      this.ctx.repos.relatorios.estatisticasPorFase(turmaId),
    ]);
    const daFase = new Map(porFase.map((e) => [e.faseId, e]));

    return ordenarFases(fases).map((f) => ({
      faseId: f.id,
      titulo: f.titulo,
      tipo: f.tipo,
      nivelOrdem: f.nivel.ordem,
      nivelTitulo: f.nivel.titulo,
      ordem: f.ordem,
      ...indicadores(daFase.get(f.id) ?? SEM_TENTATIVAS),
    }));
  }

  /** PIVOT aluno × fase: o "boletim" da turma com as melhores estrelas de cada aluno em cada fase. */
  async boletim(turmaId: number): Promise<Boletim> {
    const turma = await this.exigirTurma(turmaId);
    const { repos } = this.ctx;
    const [todasAsFases, alunos] = await Promise.all([
      repos.conteudo.listarFases(),
      repos.alunos.listarPorTurma(turmaId),
    ]);
    const fases = ordenarFases(todasAsFases);
    const progressosDosAlunos = await Promise.all(alunos.map((a) => repos.progressos.listarPorAluno(a.id)));

    // Linhas = alunos; colunas = fases. Cada célula = melhor estrelas (ou null se nunca jogou).
    const linhas = alunos
      .map((aluno, i) => {
        const porFase = new Map(progressosDosAlunos[i]!.map((p) => [p.faseId, p]));
        const estrelas = fases.map((f) => porFase.get(f.id)?.melhorEstrelas ?? null);
        return {
          alunoId: aluno.id,
          nome: aluno.nome,
          status: aluno.status,
          estrelas,
          totalEstrelas: estrelas.reduce<number>((soma, e) => soma + (e ?? 0), 0),
          fasesConcluidas: fases.filter((f) => porFase.get(f.id)?.concluida).length,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    // Rodapé: média de cada COLUNA (só de quem jogou aquela fase)
    const mediaPorFase = fases.map((_, coluna) => {
      const valores = linhas.map((l) => l.estrelas[coluna]).filter((e): e is number => e !== null);
      return valores.length > 0 ? arredondar(valores.reduce((s, v) => s + v, 0) / valores.length) : null;
    });

    return {
      turma: { id: turma.id, nome: turma.nome },
      fases: fases.map((f) => ({ faseId: f.id, titulo: f.titulo, nivelOrdem: f.nivel.ordem, ordem: f.ordem })),
      linhas,
      mediaPorFase,
    };
  }

  /** Os desafios em que a turma mais erra (para o professor reforçar o conteúdo). */
  async desafiosMaisErrados(turmaId: number, input: DesafiosMaisErradosInput = {}): Promise<DesafioComErros[]> {
    const { limite } = desafiosMaisErradosSchema.parse(input);
    await this.exigirTurma(turmaId);
    const { repos } = this.ctx;

    const [porDesafio, fases] = await Promise.all([
      repos.relatorios.errosPorDesafio(turmaId),
      repos.conteudo.listarFases(),
    ]);
    const faseDe = new Map(fases.map((f) => [f.id, f]));

    const maisErrados = porDesafio
      .filter((d) => d.erros > 0)
      .map((d) => ({ ...d, taxaErro: porcentagem(d.erros, d.respostas)! }))
      .sort((a, b) => b.taxaErro - a.taxaErro || b.erros - a.erros || a.desafioId - b.desafioId)
      .slice(0, limite);

    return Promise.all(
      maisErrados.map(async (d) => {
        const desafio = await repos.conteudo.buscarDesafio(d.desafioId);
        const fase = desafio ? faseDe.get(desafio.faseId) : undefined;
        return {
          desafioId: d.desafioId,
          enunciado: desafio?.enunciado ?? '(desafio removido)',
          respostaCorreta: desafio?.respostaCorreta ?? null,
          ordem: desafio?.ordem ?? null,
          faseId: desafio?.faseId ?? null,
          faseTitulo: fase?.titulo ?? null,
          respostas: d.respostas,
          erros: d.erros,
          taxaErro: d.taxaErro,
        };
      }),
    );
  }

  private async exigirTurma(id: number): Promise<Turma> {
    const turma = await this.ctx.repos.turmas.buscarPorId(id);
    if (!turma) throw Erros.turmaNaoEncontrada();
    return turma;
  }
}