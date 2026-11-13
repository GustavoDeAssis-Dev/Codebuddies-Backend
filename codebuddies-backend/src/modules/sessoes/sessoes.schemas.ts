import { z } from 'zod';

export const criarSessaoSchema = z.object({
  turmaId: z.coerce.number().int().positive('Escolha uma turma'),
});

// Filtros da listagem: GET /api/sessoes?turmaId=1&status=ENCERRADA
export const filtroSessoesSchema = z.object({
  turmaId: z.coerce.number().int().positive().optional(),
  status: z.enum(['CRIADA', 'ABERTA', 'ENCERRADA']).optional(),
});