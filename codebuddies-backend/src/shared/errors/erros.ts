import { AppError } from './app-error.js';

/**
 * Catálogo central de erros de negócio.
 * O `code` é o que o front-end usa para decidir a mensagem/tela; não mude códigos sem avisar o Dhérick.
 */
export const Erros = {

    // Autenticação / autorização (Etapa 3)
  naoAutenticado: () => new AppError('Você precisa entrar primeiro.', 401, 'NAO_AUTENTICADO'),
  tokenInvalido: () => new AppError('Sua entrada expirou. Entre novamente.', 401, 'TOKEN_INVALIDO'),
  semPermissao: () => new AppError('Você não tem permissão para isso.', 403, 'SEM_PERMISSAO'),
  credenciaisInvalidas: () => new AppError('E-mail ou senha incorretos.', 401, 'CREDENCIAIS_INVALIDAS'),
  emailJaCadastrado: () => new AppError('Já existe um professor com este e-mail.', 409, 'EMAIL_JA_CADASTRADO'),
  professorNaoEncontrado: () => new AppError('Professor não encontrado.', 404, 'PROFESSOR_NAO_ENCONTRADO'),
  senhaAtualIncorreta: () => new AppError('A senha atual está incorreta.', 400, 'SENHA_ATUAL_INCORRETA'),
  naoPodeDesativarASiMesmo: () => new AppError('Você não pode desativar a sua própria conta.', 400, 'NAO_PODE_DESATIVAR_A_SI_MESMO'),
  // Sessão
  sessaoFechada: () => new AppError('Aguardando professor iniciar a aula.', 403, 'SESSAO_FECHADA'), // CA01 / RN02
  outraSessaoAberta: () => new AppError('Já existe uma sessão aberta. Encerre-a antes de abrir outra.', 409, 'OUTRA_SESSAO_ABERTA'), // RN01
  sessaoNaoEncontrada: () => new AppError('Sessão não encontrada.', 404, 'SESSAO_NAO_ENCONTRADA'),
  sessaoJaAberta: () => new AppError('Esta sessão já está aberta.', 409, 'SESSAO_JA_ABERTA'),
  sessaoNaoEstaAberta: () => new AppError('Esta sessão não está aberta.', 409, 'SESSAO_NAO_ABERTA'),
  sessaoJaEncerrada: () => new AppError('Esta sessão já foi encerrada.', 409, 'SESSAO_ENCERRADA'),

  // Turma
  turmaNaoEncontrada: () => new AppError('Turma não encontrada.', 404, 'TURMA_NAO_ENCONTRADA'),
  turmaComAulaAberta: () => new AppError('Encerre a aula aberta antes de desativar a turma.', 409, 'TURMA_COM_AULA_ABERTA'),

  // Aluno
  alunoNaoEncontrado: () => new AppError('Aluno não encontrado.', 404, 'ALUNO_NAO_ENCONTRADO'),
  alunoDesativado: () => new AppError('Este aluno está desativado. Fale com o professor.', 403, 'ALUNO_DESATIVADO'), // RN10
  alunoForaDaSessao: () => new AppError('Você precisa entrar na aula primeiro.', 403, 'ALUNO_FORA_DA_SESSAO'),
  alunoJaExiste: () => new AppError('Já existe um aluno com este nome e idade nesta turma.', 409, 'ALUNO_JA_EXISTE'),

   // Conteúdo: níveis, fases e desafios (Etapa 6)
  nivelNaoEncontrado: () => new AppError('Nível não encontrado.', 404, 'NIVEL_NAO_ENCONTRADO'),
  nivelDuplicado: () => new AppError('Já existe um nível com este número.', 409, 'NIVEL_DUPLICADO'),
  nivelComFases: () =>
    new AppError('Este nível tem fases. Remova ou mova as fases antes.', 409, 'NIVEL_COM_FASES'),
  faseNaoEncontrada: () => new AppError('Fase não encontrada.', 404, 'FASE_NAO_ENCONTRADA'),
  faseBloqueada: () =>
    new AppError('Esta fase ainda está bloqueada. Conclua a anterior!', 403, 'FASE_BLOQUEADA'), // RN07 / RN13
  ordemFaseDuplicada: () =>
    new AppError('Já existe uma fase nesta posição deste nível.', 409, 'ORDEM_FASE_DUPLICADA'),
  faseComDesafios: () =>
    new AppError('Esta fase tem desafios. Remova os desafios antes.', 409, 'FASE_COM_DESAFIOS'),
  faseJaJogada: () =>
    new AppError(
      'Esta fase já foi jogada por alunos: não pode ser apagada nem perder desafios.',
      409,
      'FASE_JA_JOGADA',
    ),
  faseSemDesafios: () =>
    new AppError('Esta fase ainda não tem desafios. Fale com o professor.', 409, 'FASE_SEM_DESAFIOS'),
  desafioNaoEncontrado: () => new AppError('Desafio não encontrado.', 404, 'DESAFIO_NAO_ENCONTRADO'),
  ordemDesafioDuplicada: () =>
    new AppError('Já existe um desafio nesta posição desta fase.', 409, 'ORDEM_DESAFIO_DUPLICADA'),
    // Respostas (Etapa 7)
  desafioForaDaFase: () =>
    new AppError('Uma das respostas não é de um desafio desta fase.', 400, 'DESAFIO_FORA_DA_FASE'),
  respostaDuplicada: () =>
    new AppError('O mesmo desafio foi respondido mais de uma vez.', 400, 'RESPOSTA_DUPLICADA'),
  conteudoEmUso: () =>
    new AppError(
      'Este item está sendo usado por outros dados e não pode ser apagado.',
      409,
      'CONTEUDO_EM_USO',
    ),

  // Ranking
  rankingIndisponivel: () => new AppError('O ranking aparece quando o professor encerrar a aula.', 403, 'RANKING_INDISPONIVEL'), // RN08 / CA08
  
  // Infraestrutura (Etapa 10)
  jsonInvalido: () => new AppError('JSON malformado.', 400, 'JSON_INVALIDO'),
  conteudoMuitoGrande: () =>
    new AppError('Os dados enviados são grandes demais.', 413, 'CONTEUDO_MUITO_GRANDE'),
  bancoIndisponivel: () =>
    new AppError(
      'O sistema está com problema de conexão. Tente de novo em instantes.',
      503,
      'BANCO_INDISPONIVEL',
    ),
  muitasRequisicoes: () =>
  new AppError('Muitas ações seguidas. Espere um pouquinho e tente de novo.', 429, 'MUITAS_REQUISICOES'),
} as const;
