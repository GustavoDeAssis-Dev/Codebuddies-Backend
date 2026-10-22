import bcrypt from 'bcryptjs';

/**
 * Hash de senha com bcrypt.
 * - O hash não pode ser "desfeito": para conferir, o bcrypt recalcula e compara.
 * - CUSTO = quantas rodadas de embaralhamento (10 ≈ 100 ms; deixa ataques de força bruta lentos).
 */
const CUSTO = 10;

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, CUSTO);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}