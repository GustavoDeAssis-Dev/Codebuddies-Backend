import { z } from 'zod';

/**
 * Etapa 7 — o front manda AS RESPOSTAS de cada desafio (não mais "acertos" e "erros").
 * Quem decide o que está certo é o back-end.
 */
export const registrarTentativaSchema = z.object({
  faseId: z.int('Fase inválida').positive('Fase inválida'),
  tempoSegundos: z.int('Tempo inválido').min(0, 'Tempo inválido').max(3600, 'Tempo máximo: 1 hora'),
  respostas: z
    .array(
      z.object({
        desafioId: z.int('Desafio inválido').positive('Desafio inválido'),
        // Limite igual à coluna RESPOSTA_DESAFIO.RESPOSTA_SUBMETIDA (VARCHAR2(100))
        resposta: z.string({ error: 'A resposta deve ser um texto' }).trim().max(100, 'Resposta muito grande'),
      }),
      { error: 'Envie a lista de respostas' },
    )
    .min(1, 'Responda pelo menos um desafio')
    .max(99, 'Respostas demais'),
});

export type RegistrarTentativaInput = z.input<typeof registrarTentativaSchema>;