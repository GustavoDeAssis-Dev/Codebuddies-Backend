import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { Erros } from '../errors/erros.js';

/**
 * O que vai "escrito na pulseira" (payload do JWT).
 * `sub` (subject) é o padrão do JWT para "de quem é este token".
 */
export type UsuarioAutenticado =
  | { perfil: 'PROFESSOR'; id: number }
  | { perfil: 'ALUNO'; id: number; sessaoId: number };

export type Perfil = UsuarioAutenticado['perfil'];

interface PayloadToken {
  sub: string;
  perfil: Perfil;
  sessaoId?: number;
}

export function gerarToken(usuario: UsuarioAutenticado): string {
  const payload: PayloadToken = { sub: String(usuario.id), perfil: usuario.perfil };
  if (usuario.perfil === 'ALUNO') payload.sessaoId = usuario.sessaoId;

  const expiracao = usuario.perfil === 'PROFESSOR' ? env.JWT_EXPIRACAO_PROFESSOR : env.JWT_EXPIRACAO_ALUNO;

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: expiracao as jwt.SignOptions['expiresIn'],
  });
}

/** Confere assinatura e validade. Se algo estiver errado, lança TOKEN_INVALIDO. */
export function verificarToken(token: string): UsuarioAutenticado {
  let payload: PayloadToken;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as PayloadToken;
  } catch {
    throw Erros.tokenInvalido(); // assinatura falsa, token alterado ou expirado
  }

  const id = Number(payload.sub);
  if (payload.perfil === 'PROFESSOR') return { perfil: 'PROFESSOR', id };
  if (payload.perfil === 'ALUNO' && payload.sessaoId) {
    return { perfil: 'ALUNO', id, sessaoId: payload.sessaoId };
  }
  throw Erros.tokenInvalido();
}