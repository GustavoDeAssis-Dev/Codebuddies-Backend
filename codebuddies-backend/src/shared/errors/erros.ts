import { AppError } from './app-error.js';

/**
 * Catálogo central de erros de negócio.
 * O `code` é o que o front-end usa para decidir a mensagem/tela; não mude códigos sem avisar o Dhérick.
 */
export const Erros = {
  // Sessão
  sessaoFechada: () => new AppError('Aguardando professor iniciar a aula.', 403, 'SESSAO_FECHADA'), // CA01 / RN02
  outraSessaoAberta: () =>
    new AppError('Já existe uma sessão aberta. Encerre-a antes de abrir outra.', 409, 'OUTRA_SESSAO_ABERTA'), // RN01
  sessaoNaoEncontrada: () => new AppError('Sessão não encontrada.', 404, 'SESSAO_NAO_ENCONTRADA'),
  sessaoJaAberta: () => new AppError('Esta sessão já está aberta.', 409, 'SESSAO_JA_ABERTA'),
  sessaoNaoEstaAberta: () => new AppError('Esta sessão não está aberta.', 409, 'SESSAO_NAO_ABERTA'),
  sessaoJaEncerrada: () => new AppError('Esta sessão já foi encerrada.', 409, 'SESSAO_ENCERRADA'),

  // Turma
  turmaNaoEncontrada: () => new AppError('Turma não encontrada.', 404, 'TURMA_NAO_ENCONTRADA'),

  // Aluno
  alunoNaoEncontrado: () => new AppError('Aluno não encontrado.', 404, 'ALUNO_NAO_ENCONTRADO'),
  alunoDesativado: () =>
    new AppError('Este aluno está desativado. Fale com o professor.', 403, 'ALUNO_DESATIVADO'), // RN10
  alunoForaDaSessao: () => new AppError('Você precisa entrar na aula primeiro.', 403, 'ALUNO_FORA_DA_SESSAO'),

  // Fases
  faseNaoEncontrada: () => new AppError('Fase não encontrada.', 404, 'FASE_NAO_ENCONTRADA'),
  faseBloqueada: () =>
    new AppError('Esta fase ainda está bloqueada. Conclua a anterior!', 403, 'FASE_BLOQUEADA'), // RN07 / RN13

  // Ranking
  rankingIndisponivel: () =>
    new AppError('O ranking aparece quando o professor encerrar a aula.', 403, 'RANKING_INDISPONIVEL'), // RN08 / CA08
} as const;
