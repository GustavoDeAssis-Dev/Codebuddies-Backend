import type {
  Aluno,
  Fase,
  FaseComNivel,
  Participacao,
  Progresso,
  RankingFinal,
  Sessao,
  StatusAluno,
  Tentativa,
  Turma,
  Professor
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
}

export interface SessaoRepository {
  buscarPorId(id: number): Promise<Sessao | null>;
  buscarAberta(): Promise<Sessao | null>;
  criar(dados: { turmaId: number; criadaEm: Date }): Promise<Sessao>;
  atualizar(sessao: Sessao): Promise<Sessao>;
}

export interface AlunoRepository {
  buscarPorId(id: number): Promise<Aluno | null>;
  buscarPorIdentificacao(turmaId: number, nomeNormalizado: string, idade: number): Promise<Aluno | null>;
  criar(dados: Omit<Aluno, 'id'>): Promise<Aluno>;
  atualizarStatus(id: number, status: StatusAluno): Promise<Aluno>;
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
}

export interface Repositorios {
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
