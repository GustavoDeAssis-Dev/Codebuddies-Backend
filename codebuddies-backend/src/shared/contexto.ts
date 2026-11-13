import { env } from '../config/env.js';
import type { Repositorios } from '../repositories/contratos.js';
import { criarRepositoriosEmMemoria } from '../repositories/memoria/index.js';

/**
 * Dependências que os services recebem.
 * `agora` existe para os testes poderem controlar o relógio.
 */
export interface Contexto {
  repos: Repositorios;
  agora: () => Date;
  /** Fecha a conexão com o banco (usado ao desligar o servidor). */
  encerrar?: () => Promise<void>;
}

/** Contexto com banco EM MEMÓRIA (testes automáticos e desenvolvimento sem banco). */
export function criarContexto(): Contexto {
  return { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
}

/**
 * Contexto escolhido pelo .env: BANCO=memoria ou BANCO=oracle.
 * As regras de negócio não sabem qual dos dois está em uso — só conhecem os contratos.
 */
export async function criarContextoDoAmbiente(): Promise<Contexto> {
  if (env.BANCO === 'memoria') return criarContexto();

  // import dinâmico: o TypeORM/Oracle só é carregado quando BANCO=oracle
  const { criarDataSource } = await import('../database/data-source.js');
  const { criarRepositoriosOracle } = await import('../repositories/oracle/index.js');

  const dataSource = criarDataSource();
  await dataSource.initialize();

  return {
    repos: criarRepositoriosOracle(dataSource.manager),
    agora: () => new Date(),
    encerrar: () => dataSource.destroy(),
  };
}