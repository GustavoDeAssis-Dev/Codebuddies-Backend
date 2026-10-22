import type { NextFunction, Request, Response } from 'express';
import { verificarToken, type Perfil } from '../auth/token.js';
import { Erros } from '../errors/erros.js';

/**
 * AUTENTICAÇÃO — "quem é você?"
 * Lê o cabeçalho `Authorization: Bearer <token>`, confere o token
 * e guarda o usuário em `req.usuario` para as próximas etapas da rota.
 */
export function autenticar(req: Request, _res: Response, next: NextFunction) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw Erros.naoAutenticado();

  req.usuario = verificarToken(token);
  next();
}

/**
 * AUTORIZAÇÃO — "você pode fazer isso?"
 * Uso: router.post('/sessoes', autenticar, exigirPerfil('PROFESSOR'), handler)
 */
export function exigirPerfil(...perfis: Perfil[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.usuario) throw Erros.naoAutenticado();
    if (!perfis.includes(req.usuario.perfil)) throw Erros.semPermissao();
    next();
  };
}