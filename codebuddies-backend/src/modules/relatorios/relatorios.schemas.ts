import { z } from 'zod';

/** ?limite=5 na URL (query string sempre chega como texto → coerce converte para número). */
export const desafiosMaisErradosSchema = z.object({
  limite: z.coerce
    .number({ error: 'Limite inválido' })
    .int('Limite inválido')
    .min(1, 'Limite mínimo: 1')
    .max(50, 'Limite máximo: 50')
    .default(5),
});

export type DesafiosMaisErradosInput = z.input<typeof desafiosMaisErradosSchema>;