import { z } from 'zod';

const nome = z.string().trim().min(2, 'Nome muito curto').max(60, 'Nome muito grande');

export const criarTurmaSchema = z.object({ nome });

// No PATCH tudo é opcional: só muda o que vier no corpo
export const atualizarTurmaSchema = z
  .object({ nome: nome.optional(), ativa: z.boolean().optional() })
  .refine((d) => d.nome !== undefined || d.ativa !== undefined, { message: 'Nada para atualizar' });

export type CriarTurmaInput = z.input<typeof criarTurmaSchema>;
export type AtualizarTurmaInput = z.input<typeof atualizarTurmaSchema>;