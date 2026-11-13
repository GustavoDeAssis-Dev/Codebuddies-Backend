import { describe, expect, it } from 'vitest';
import { comTraducaoDeErros, traduzirErroOracle } from '../src/repositories/oracle/erros-oracle.js';

/** Imita o erro que o TypeORM devolve quando o Oracle recusa algo. */
const erroOracle = (errorNum: number, message = '') => ({ driverError: { errorNum, message } });

describe('Tradução de erros do Oracle', () => {
  it.each([
    [20010, 'SESSAO_JA_ABERTA'],
    [20011, 'SESSAO_ENCERRADA'],
    [20013, 'SESSAO_NAO_ENCONTRADA'],
    [20014, 'OUTRA_SESSAO_ABERTA'],
    [20020, 'SESSAO_ENCERRADA'],
    [20021, 'SESSAO_NAO_ABERTA'],
    [20022, 'SESSAO_NAO_ENCONTRADA'],
  ])('procedure ORA-%i → %s', (numero, codigo) => {
    expect(traduzirErroOracle(erroOracle(numero))).toMatchObject({ code: codigo });
  });

  it('ORA-00001 usa o nome da constraint para saber a regra', () => {
    const aberta = erroOracle(1, 'ORA-00001: unique constraint (CODEBUDDIES.UX_SESSAO_ABERTA) violated');
    const aluno = erroOracle(1, 'ORA-00001: unique constraint (CODEBUDDIES.UQ_ALUNO_TURMA) violated');
    expect(traduzirErroOracle(aberta)).toMatchObject({ code: 'OUTRA_SESSAO_ABERTA' });
    expect(traduzirErroOracle(aluno)).toMatchObject({ code: 'ALUNO_JA_EXISTE' });
  });

  it('erro desconhecido passa adiante sem mudar', () => {
    const outro = erroOracle(12541, 'ORA-12541: TNS:no listener');
    expect(traduzirErroOracle(outro)).toBe(outro);
    const comum = new Error('qualquer');
    expect(traduzirErroOracle(comum)).toBe(comum);
  });

  it('comTraducaoDeErros traduz o erro de qualquer método do repositório', async () => {
    const repo = comTraducaoDeErros({
      abrir: async () => {
        throw erroOracle(20014);
      },
      ok: async () => 42,
    });
    await expect(repo.abrir()).rejects.toMatchObject({ code: 'OUTRA_SESSAO_ABERTA' });
    await expect(repo.ok()).resolves.toBe(42);
  });
});