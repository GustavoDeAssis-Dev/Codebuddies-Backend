import { z } from 'zod';

/**
 * O front envia o que a criança FEZ (acertos, erros, tempo) — nunca as estrelas.
 * erros = respostas erradas, inclusive as que a criança corrigiu depois.
 */
export const registrarTentativaSchema = z
  .object({
    faseId: z.coerce.number().int().positive(),
    acertos: z.coerce.number().int().min(0).max(1000),
    erros: z.coerce.number().int().min(0).max(1000),
    tempoSegundos: z.coerce.number().int().min(0).max(3600),
  })
  .refine((d) => d.acertos + d.erros > 0, { message: 'É preciso ao menos uma resposta', path: ['acertos'] });

export type RegistrarTentativaInput = z.input<typeof registrarTentativaSchema>;
