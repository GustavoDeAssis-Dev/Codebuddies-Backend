import type { Repositorios } from '../repositories/contratos.js';

/**
 * Dependências que os services recebem.
 * `agora` existe para os testes poderem controlar o relógio.
 */
export interface Contexto {
  repos: Repositorios;
  agora: () => Date;
}
