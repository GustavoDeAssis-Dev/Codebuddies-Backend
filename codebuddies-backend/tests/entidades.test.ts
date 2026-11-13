import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { entidades } from '../src/database/entidades.js';

/**
 * Confere as ANOTAÇÕES das entidades sem conectar no Oracle:
 * o TypeORM monta os metadados (tabelas, colunas, chaves, relacionamentos) e valida tudo.
 */
async function metadados() {
  const ds = new DataSource({ type: 'oracle', connectString: 'localhost:1521/TESTE', entities: entidades });
  // buildMetadatas é o que o initialize() faz antes de conectar
  await (ds as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  return ds;
}

describe('Entidades TypeORM (anotações)', () => {
  it('as 12 tabelas são reconhecidas, com nomes em maiúsculas', async () => {
    const ds = await metadados();
    expect(ds.entityMetadatas.map((m) => m.tableName).sort()).toEqual([
      'ALUNO',
      'DESAFIO',
      'FASE',
      'NIVEL',
      'PARTICIPACAO',
      'PROFESSOR',
      'PROGRESSO_FASE',
      'RANKING_SESSAO',
      'RESPOSTA_DESAFIO',
      'SESSAO_AULA',
      'TENTATIVA_FASE',
      'TURMA',
    ]);
  });

  it('chaves primárias compostas em PARTICIPACAO e RANKING_SESSAO', async () => {
    const ds = await metadados();
    const pk = (tabela: string) =>
      ds.entityMetadatas.find((m) => m.tableName === tabela)!.primaryColumns.map((c) => c.databaseName);
    expect(pk('PARTICIPACAO')).toEqual(['ID_SESSAO', 'ID_ALUNO']);
    expect(pk('RANKING_SESSAO')).toEqual(['ID_SESSAO', 'ID_ALUNO']);
    expect(pk('ALUNO')).toEqual(['ID_ALUNO']);
  });

  it('relacionamentos (chaves estrangeiras) apontam para as tabelas certas', async () => {
    const ds = await metadados();
    const fks = (tabela: string) =>
      ds.entityMetadatas
        .find((m) => m.tableName === tabela)!
        .foreignKeys.map((fk) => `${fk.columnNames.join(',')}->${fk.referencedEntityMetadata.tableName}`)
        .sort();
    expect(fks('SESSAO_AULA')).toEqual(['ID_PROFESSOR->PROFESSOR', 'ID_TURMA->TURMA']);
    expect(fks('ALUNO')).toEqual(['ID_TURMA->TURMA']);
    expect(fks('TENTATIVA_FASE')).toEqual(['ID_ALUNO->ALUNO', 'ID_FASE->FASE', 'ID_SESSAO->SESSAO_AULA']);
  });

  it('colunas S/N viram verdadeiro/falso', async () => {
    const ds = await metadados();
    const coluna = ds.getMetadata('PROFESSOR').findColumnWithDatabaseName('ATIVO')!;
    const t = coluna.transformer as { to(v: boolean): string; from(v: string): boolean };
    expect(t.to(true)).toBe('S');
    expect(t.to(false)).toBe('N');
    expect(t.from('S')).toBe(true);
    expect(t.from('N')).toBe(false);
  });
});