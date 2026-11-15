import type {
  Aluno,
  Fase,
  FaseComNivel,
  Participacao,
  Professor,
  Progresso,
  RankingFinal,
  Sessao,
  StatusAluno,
  StatusSessao,
  Tentativa,
  Turma,
  Desafio,
  Nivel,
  RespostaDesafio,
} from '../domain/entidades.js';

/**
 * Contratos de acesso a dados.
 *
 * As regras de negócio (services) só conhecem ESTAS interfaces, nunca o banco diretamente.
 * Duas implementações com as mesmas assinaturas: memória (testes) e Oracle (uso real).
 */

export interface TurmaRepository {
  buscarPorId(id: number): Promise<Turma | null>;
  criar(dados: { nome: string; criadaEm: Date }): Promise<Turma>;
  listar(): Promise<Turma[]>; // NOVO
  atualizar(turma: Turma): Promise<Turma>; // NOVO
}

export interface SessaoRepository {
  buscarPorId(id: number): Promise<Sessao | null>;
  buscarAberta(): Promise<Sessao | null>;
  criar(dados: { turmaId: number; professorId: number; criadaEm: Date }): Promise<Sessao>;
  listar(filtro?: { turmaId?: number; status?: StatusSessao }): Promise<Sessao[]>;
  /** CRIADA → ABERTA. No Oracle chama a procedure PRC_ABRIR_SESSAO. */
  abrir(id: number, em: Date): Promise<Sessao>;
  /** ABERTA → ENCERRADA. No Oracle chama a procedure PRC_ENCERRAR_SESSAO. */
  encerrar(id: number, em: Date): Promise<Sessao>;
}

export interface AlunoRepository {
  buscarPorId(id: number): Promise<Aluno | null>;
  buscarPorIdentificacao(turmaId: number, nomeNormalizado: string, idade: number): Promise<Aluno | null>;
  criar(dados: Omit<Aluno, 'id'>): Promise<Aluno>;
  atualizarStatus(id: number, status: StatusAluno): Promise<Aluno>;
  atualizar(aluno: Aluno): Promise<Aluno>; // NOVO
  listarPorTurma(turmaId: number): Promise<Aluno[]>; // NOVO
}

export interface ParticipacaoRepository {
  /** Idempotente: registrar duas vezes o mesmo aluno na mesma sessão não duplica. */
  registrar(dados: Participacao): Promise<void>;
  existe(sessaoId: number, alunoId: number): Promise<boolean>;
  listarPorSessao(sessaoId: number): Promise<Participacao[]>;
}

/** Conteúdo pedagógico: Nível 1──N Fase 1──N Desafio (gerenciado pelo professor — Etapa 6). */
export interface ConteudoRepository {
  // Níveis
  listarNiveis(): Promise<Nivel[]>;
  buscarNivel(id: number): Promise<Nivel | null>;
  buscarNivelPorOrdem(ordem: number): Promise<Nivel | null>;
  criarNivel(dados: Omit<Nivel, 'id'>): Promise<Nivel>;
  atualizarNivel(nivel: Nivel): Promise<Nivel>;
  removerNivel(id: number): Promise<void>;

  // Fases
  listarFases(): Promise<FaseComNivel[]>;
  buscarFase(id: number): Promise<Fase | null>;
  buscarFasePorOrdem(nivelId: number, ordem: number): Promise<Fase | null>;
  criarFase(dados: Omit<Fase, 'id'>): Promise<Fase>;
  atualizarFase(fase: Fase): Promise<Fase>;
  removerFase(id: number): Promise<void>;

  // Desafios
  /** Desafios da fase, já em ordem. */
  listarDesafios(faseId: number): Promise<Desafio[]>;
  buscarDesafio(id: number): Promise<Desafio | null>;
  criarDesafio(dados: Omit<Desafio, 'id'>): Promise<Desafio>;
  atualizarDesafio(desafio: Desafio): Promise<Desafio>;
  removerDesafio(id: number): Promise<void>;
}
  /**
   * Grava a tentativa. O PROGRESSO é atualizado junto, automaticamente:
   * no Oracle pela trigger TRG_ATUALIZA_PROGRESSO_OFICIAL; em memória por consolidarProgresso().
   */
export interface TentativaRepository {
  criar(dados: Omit<Tentativa, 'id'>): Promise<Tentativa>;
  listarPorSessao(sessaoId: number): Promise<Tentativa[]>;
    /** true se algum aluno já jogou esta fase (aí ela não pode mais ser apagada). */
  existeNaFase(faseId: number): Promise<boolean>;
    /** Todas as jogadas do aluno (usado nas conquistas — Etapa 8). */
  listarPorAluno(alunoId: number): Promise<Tentativa[]>;
}

/** Respostas corrigidas de cada desafio → tabela RESPOSTA_DESAFIO (Etapa 7). */
export interface RespostaRepository {
  /** Grava uma linha por desafio da tentativa. */
  registrar(tentativaId: number, itens: Omit<RespostaDesafio, 'id' | 'tentativaId'>[]): Promise<void>;
  listarPorTentativa(tentativaId: number): Promise<RespostaDesafio[]>;
}

export interface ProgressoRepository {
  listarPorAluno(alunoId: number): Promise<Progresso[]>;
  buscar(alunoId: number, faseId: number): Promise<Progresso | null>;
}

export interface RankingRepository {
  salvar(ranking: RankingFinal): Promise<void>;
  buscarPorSessao(sessaoId: number): Promise<RankingFinal | null>;
}

export interface ProfessorRepository {
  buscarPorId(id: number): Promise<Professor | null>;
  buscarPorEmail(email: string): Promise<Professor | null>;
  criar(dados: Omit<Professor, 'id'>): Promise<Professor>;
  listar(): Promise<Professor[]>; // NOVO
  atualizar(professor: Professor): Promise<Professor>; // NOVO
}

/** Resultado das funções de agregação sobre um conjunto de tentativas (Etapa 9). */
export interface EstatisticasTentativas {
  totalTentativas: number; // COUNT
  alunosQueJogaram: number; // COUNT DISTINCT
  mediaEstrelas: number | null; // AVG  (null = ninguém jogou)
  mediaPercentual: number | null; // AVG
  maiorPercentual: number | null; // MAX
  menorPercentual: number | null; // MIN
  somaPontos: number | null; // SUM
  tempoMedioSegundos: number | null; // AVG
  aprovacoes: number | null; // SUM(CASE ...) — tentativas com 3+ estrelas
}

export interface EstatisticasPorFase extends EstatisticasTentativas {
  faseId: number;
}

export interface ErrosPorDesafio {
  desafioId: number;
  respostas: number; // COUNT
  erros: number; // SUM(CASE WHEN errou ...)
}

/** Consultas de relatório: sempre filtradas pela turma (Etapa 9). */
export interface RelatorioRepository {
  /** Agregações de todas as tentativas dos alunos da turma. */
  estatisticasDaTurma(turmaId: number): Promise<EstatisticasTentativas>;
  /** As mesmas agregações, agrupadas por fase (GROUP BY). Fase sem tentativas não aparece. */
  estatisticasPorFase(turmaId: number): Promise<EstatisticasPorFase[]>;
  /** Respostas e erros de cada desafio respondido pelos alunos da turma (GROUP BY). */
  errosPorDesafio(turmaId: number): Promise<ErrosPorDesafio[]>;
}

export interface Repositorios {
  professores: ProfessorRepository;
  turmas: TurmaRepository;
  sessoes: SessaoRepository;
  alunos: AlunoRepository;
  participacoes: ParticipacaoRepository;
  conteudo: ConteudoRepository;
  tentativas: TentativaRepository;
  respostas: RespostaRepository;
  progressos: ProgressoRepository;
  rankings: RankingRepository;
  relatorios: RelatorioRepository;
    /**
   * Executa várias operações numa TRANSAÇÃO: ou tudo é gravado, ou nada é.
   * Ex.: encerrar a aula + salvar o ranking. Se o ranking falhar, a aula continua aberta.
   */
  transacao<T>(trabalho: (repos: Repositorios) => Promise<T>): Promise<T>;
}