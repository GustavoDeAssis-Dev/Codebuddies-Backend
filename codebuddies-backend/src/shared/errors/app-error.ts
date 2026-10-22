/**
 * Erro "esperado" da aplicação (regra de negócio, recurso não encontrado, etc.).
 * O middleware de erros transforma isto numa resposta JSON padronizada.
 *
 * `code` é um identificador estável que o front-end pode usar para decidir
 * qual mensagem amigável mostrar à criança (ex.: SESSAO_FECHADA).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
    public readonly code = 'ERRO_APLICACAO',
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
