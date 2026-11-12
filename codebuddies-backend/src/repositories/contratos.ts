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
} from '../domain/entidades.js';

/**
 * Contratos de acesso a dados.
 *
 * As regras de negócio (services) só conhecem ESTAS interfaces, nunca o banco diretamente.
 * Hoje existe a implementação em memória (src/repositories/memoria) para desenvolver e testar;
 * na Etapa 5 criamos a implementação Oracle com as mesmas assinaturas — sem mexer nas regras.
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

export interface ConteudoRepository {
  listarFases(): Promise<FaseComNivel[]>;
  buscarFase(id: number): Promise<Fase | null>;
}
  /**
   * Grava a tentativa. O PROGRESSO é atualizado junto, automaticamente:
   * no Oracle pela trigger TRG_ATUALIZA_PROGRESSO_OFICIAL; em memória por consolidarProgresso().
   */
export interface TentativaRepository {
  criar(dados: Omit<Tentativa, 'id'>): Promise<Tentativa>;
  listarPorSessao(sessaoId: number): Promise<Tentativa[]>;
}

export interface ProgressoRepository {
  listarPorAluno(alunoId: number): Promise<Progresso[]>;
  buscar(alunoId: number, faseId: number): Promise<Progresso | null>;
  salvar(progresso: Progresso): Promise<Progresso>;
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

export interface Repositorios {

  /**
   * Executa várias operações numa TRANSAÇÃO: ou tudo é gravado, ou nada é.
   * Ex.: encerrar a aula + salvar o ranking. Se o ranking falhar, a aula continua aberta.
   */
  transacao<T>(trabalho: (repos: Repositorios) => Promise<T>): Promise<T>;
  professores: ProfessorRepository;
  turmas: TurmaRepository;
  sessoes: SessaoRepository;
  alunos: AlunoRepository;
  participacoes: ParticipacaoRepository;
  conteudo: ConteudoRepository;
  tentativas: TentativaRepository;
  progressos: ProgressoRepository;
  rankings: RankingRepository;
}