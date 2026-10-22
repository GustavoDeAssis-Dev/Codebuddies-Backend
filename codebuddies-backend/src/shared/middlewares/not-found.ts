import type { Request, Response } from 'express';

export function notFound(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'ROTA_NAO_ENCONTRADA', message: `Rota ${req.method} ${req.originalUrl} não existe.` },
  });
}
