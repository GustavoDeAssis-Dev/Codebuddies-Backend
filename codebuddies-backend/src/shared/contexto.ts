import type { Repositorios } from '../repositories/contratos.js';
import { criarRepositoriosEmMemoria } from '../repositories/memoria/index.js';

/**
 * Dependências que os services recebem.
 * `agora` existe para os testes poderem controlar o relógio.
 */
export function criarContexto(): Contexto {
  return { repos: criarRepositoriosEmMemoria(), agora: () => new Date() };
}

export interface Contexto {
  repos: Repositorios;
  agora: () => Date;
}
