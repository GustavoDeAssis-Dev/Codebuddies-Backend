/**
 * Entidades do domínio CodeBuddies (modelo "Opção B": progresso guardado por TURMA).
 *
 * Turma 1──N Sessão (cada aula é uma sessão)
 * Turma 1──N Aluno  (o aluno pertence à turma e é reconhecido por nome + idade)
 * Sessão N──N Aluno (Participação: quem entrou em qual aula)
 * Nível 1──N Fase
 * Tentativa: cada vez que um aluno termina uma fase (ligada à sessão em que ocorreu)
 * Progresso: melhor resultado do aluno em cada fase (vale entre aulas)
 *
 * Estes tipos são o "contrato" com o banco: o Leonardo pode usar como referência para as tabelas.
 */

export interface Turma {
  id: number;
  nome: string; // ex.: "2º ano B"
  ativa: boolean;
  criadaEm: Date;
}

/** AGUARDANDO = criada mas ainda não aberta; ABERTA = alunos podem entrar; ENCERRADA = finalizada. */
export type StatusSessao = 'AGUARDANDO' | 'ABERTA' | 'ENCERRADA';

export interface Sessao {
  id: number;
  turmaId: number;
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
  personagem: string | null;
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
  ordem: number; // 1, 2, 3...
  titulo: string;
}

export type TipoFase = 'DIGITACAO' | 'LOGICA' | 'COMPUTACAO_BASICA';

export interface Fase {
  id: number;
  nivelId: number;
  ordem: number; // posição da fase dentro do nível
  titulo: string;
  tipo: TipoFase;
  dificuldade: number; // 1 a 5
  ativa: boolean;
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
  acertos: number;
  erros: number;
  percentual: number; // 0 a 100 (inteiro)
  estrelas: number; // 0 a 5
  aprovada: boolean; // estrelas >= 3
  tempoSegundos: number;
  dataHora: Date;
}

export interface Progresso {
  alunoId: number;
  faseId: number;
  melhorEstrelas: number;
  tentativas: number;
  melhorTempoSegundos: number | null; // tempo da tentativa com mais estrelas
  concluida: boolean;
  ultimaTentativaEm: Date;
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
