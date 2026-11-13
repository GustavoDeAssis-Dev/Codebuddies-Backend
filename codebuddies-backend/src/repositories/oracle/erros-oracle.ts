import { Erros } from '../../shared/errors/erros.js';
import type { AppError } from '../../shared/errors/app-error.js';

/**
 * Traduz erros do Oracle para os erros de negócio do back-end (mesmos códigos que o front já conhece).
 *
 * Por que existe: o back valida as regras antes de chamar o banco (mensagens claras), e o banco
 * valida de novo (garantia contra cliques duplos). Se dois pedidos chegarem juntos, quem barra é o
 * Oracle — e aqui o erro técnico ("ORA-20014...") vira o erro amigável (OUTRA_SESSAO_ABERTA).
 */

/** Erros lançados pelas procedures do Leonardo com RAISE_APPLICATION_ERROR. */
const PROCEDURES: Record<number, () => AppError> = {
  20001: Erros.outraSessaoAberta, // trigger antiga da RN01 (caso ainda exista)
  20010: Erros.sessaoJaAberta, // prc_abrir_sessao: já está ABERTA
  20011: Erros.sessaoJaEncerrada, // prc_abrir_sessao: ENCERRADA não reabre
  20012: Erros.sessaoNaoEstaAberta, // prc_abrir_sessao: status inválido
  20013: Erros.sessaoNaoEncontrada, // prc_abrir_sessao: id não existe
  20014: Erros.outraSessaoAberta, // prc_abrir_sessao: RN01
  20020: Erros.sessaoJaEncerrada, // prc_encerrar_sessao: já ENCERRADA
  20021: Erros.sessaoNaoEstaAberta, // prc_encerrar_sessao: só ABERTA encerra
  20022: Erros.sessaoNaoEncontrada, // prc_encerrar_sessao: id não existe
};

/** ORA-00001 (valor duplicado): o nome da constraint diz qual regra foi violada. */
const UNICOS: Record<string, () => AppError> = {
  UX_SESSAO_ABERTA: Erros.outraSessaoAberta,
  UQ_ALUNO_TURMA: Erros.alunoJaExiste,
  PROFESSOR_EMAIL_UN: Erros.emailJaCadastrado,
};

interface ErroDoOracle {
  errorNum?: number;
  message?: string;
}

/** O TypeORM embrulha o erro do driver em `driverError`; às vezes ele vem direto. */
function erroDoDriver(erro: unknown): ErroDoOracle | null {
  if (typeof erro !== 'object' || erro === null) return null;
  const e = erro as { driverError?: ErroDoOracle } & ErroDoOracle;
  if (typeof e.driverError?.errorNum === 'number') return e.driverError;
  if (typeof e.errorNum === 'number') return e;
  return null;
}

/** Devolve o erro de negócio correspondente, ou o próprio erro original se não for um caso conhecido. */
export function traduzirErroOracle(erro: unknown): unknown {
  const ora = erroDoDriver(erro);
  if (!ora?.errorNum) return erro;

  const daProcedure = PROCEDURES[ora.errorNum];
  if (daProcedure) return daProcedure();

  if (ora.errorNum === 1) {
    // Mensagem do Oracle: ORA-00001: unique constraint (CODEBUDDIES.UQ_ALUNO_TURMA) violated
    const constraint = /\(\w+\.(\w+)\)/.exec(ora.message ?? '')?.[1]?.toUpperCase();
    const traduzido = constraint ? UNICOS[constraint] : undefined;
    if (traduzido) return traduzido();
  }

  return erro;
}

/** true quando o erro é "valor duplicado" (ORA-00001). */
export function ehValorDuplicado(erro: unknown): boolean {
  return erroDoDriver(erro)?.errorNum === 1;
}

/**
 * Embrulha todos os métodos de um repositório: qualquer erro do Oracle sai já traduzido.
 * Assim nenhum método precisa de try/catch próprio.
 */
export function comTraducaoDeErros<T extends object>(repositorio: T): T {
  return new Proxy(repositorio, {
    get(alvo, propriedade, receptor) {
      const valor = Reflect.get(alvo, propriedade, receptor);
      if (typeof valor !== 'function') return valor;
      return async (...args: unknown[]) => {
        try {
          return await valor.apply(alvo, args);
        } catch (erro) {
          throw traduzirErroOracle(erro);
        }
      };
    },
  });
}