/**
 * Entidades do domínio CodeBuddies (modelo "Opção B": progresso guardado por TURMA).
 *
 * Turma 1──N Sessão (cada aula é uma sessão)       → tabelas TURMA, SESSAO_AULA
 * Turma 1──N Aluno  (reconhecido por nome + idade) → tabela ALUNO
 * Sessão N──N Aluno (quem entrou em qual aula)     → tabela PARTICIPACAO
 * Nível 1──N Fase                                   → tabelas NIVEL, FASE
 * Tentativa: cada vez que um aluno termina uma fase → tabela TENTATIVA_FASE
 * Progresso: melhor resultado do aluno em cada fase → tabela PROGRESSO_FASE (mantida pela trigger)
 * Ranking congelado de cada aula                   → tabela RANKING_SESSAO
 *
 * Estes tipos são o "modelo" das regras de negócio. As classes com anotações do TypeORM
 * (src/database/entidades) fazem a ponte entre estes tipos e as tabelas do Oracle.
 */

export interface Professor {
  id: number;
  nome: string;
  email: string;
  senhaHash: string; // NUNCA a senha pura: guardamos só o hash gerado pelo bcrypt
  ativo: boolean;
  criadoEm: Date;
}

export interface Turma {
  id: number;
  nome: string; // ex.: "2º ano B"
  ativa: boolean;
  criadaEm: Date;
}

/** CRIADA = ainda não aberta; ABERTA = alunos podem entrar; ENCERRADA = finalizada. */
export type StatusSessao = 'CRIADA' | 'ABERTA' | 'ENCERRADA';

export interface Sessao {
  id: number;
  turmaId: number;
  professorId: number; // quem criou a aula
  status: StatusSessao;
  criadaEm: Date;
  dataHoraInicio: Date | null;
  dataHoraFim: Date | null;
}

export type StatusAluno = 'ATIVO' | 'DESATIVADO';

export interface Aluno {
  id: number;
  turmaId: number;
  nome: string; // como a criança digitou (limpo de espaços extras)
  nomeNormalizado: string; // usado para reconhecer o aluno: "João  " e "joao" viram "joao"
  idade: number;
  status: StatusAluno;
  criadoEm: Date;
}

export interface Participacao {
  sessaoId: number;
  alunoId: number;
  entradaEm: Date;
}

export interface Nivel {
  id: number;
  ordem: number; // numero_nivel: 1, 2, 3...
  titulo: string;
  descricao: string | null;
}

export type TipoFase = 'DIGITACAO' | 'LOGICA' | 'COMPUTACAO_BASICA';

export interface Fase {
  id: number;
  nivelId: number;
  ordem: number; // posição da fase dentro do nível
  titulo: string;
  tipo: TipoFase;
}

/** Fase já acompanhada do seu nível (facilita ordenar por nível → fase). */
export interface FaseComNivel extends Fase {
  nivel: Nivel;
}

export interface Tentativa {
  id: number;
  alunoId: number;
  faseId: number;
  sessaoId: number;
  percentual: number; // 0 a 100 (inteiro)
  estrelas: number; // 0 a 5
  pontos: number;
  aprovada: boolean; // estrelas >= 3
  tempoSegundos: number;
  dataHora: Date;
}

/** Melhor resultado do aluno numa fase. No Oracle, quem mantém é a trigger TRG_ATUALIZA_PROGRESSO_OFICIAL. */
export interface Progresso {
  alunoId: number;
  faseId: number;
  melhorEstrelas: number;
  pontuacaoMaxima: number;
  concluida: boolean;
  atualizadoEm: Date;
}

export interface ItemRanking {
  posicao: number;
  alunoId: number;
  nome: string;
  nivelAlcancado: number; // ordem do nível em que o aluno está ao final da aula
  estrelasNaSessao: number;
  fasesConcluidasNaSessao: number;
  tempoTotalSegundos: number;
}

export interface RankingFinal {
  sessaoId: number;
  geradoEm: Date;
  itens: ItemRanking[];
}