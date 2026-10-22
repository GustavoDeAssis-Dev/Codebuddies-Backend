import { Router } from 'express';

export const healthRoutes = Router();

/** GET /api/health — usado para checar se o servidor está no ar. */
healthRoutes.get('/', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()), timestamp: new Date().toISOString() });
});
