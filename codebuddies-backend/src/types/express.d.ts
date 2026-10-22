import type { UsuarioAutenticado } from '../shared/auth/token.js';

/**
 * Ensina ao TypeScript que, depois do middleware `autenticar`,
 * todo `req` pode ter o campo `usuario` (quem está logado).
 */
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

export {};