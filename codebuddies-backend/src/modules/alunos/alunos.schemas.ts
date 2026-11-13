import { z } from 'zod';
import { IDADE_MAXIMA, IDADE_MINIMA, NOME_TAMANHO_MAXIMO } from '../../domain/regras/identificacao.js';

/** RF-P01 / RF-P02 / RN03 / CA02 — entrada simples do aluno: nome + idade obrigatórios. */
export const entrarSchema = z.object({
  nome: z
    .string({ error: 'Digite seu nome' })
    .trim()
    .min(1, 'Digite seu nome')
    .max(NOME_TAMANHO_MAXIMO, 'Nome muito grande'),
  idade: z.coerce
    .number({ error: 'Digite sua idade' })
    .int('Digite sua idade')
    .min(IDADE_MINIMA, 'Idade inválida')
    .max(IDADE_MAXIMA, 'Idade inválida'),
});

export type EntrarInput = z.input<typeof entrarSchema>;
/** Etapa 4 — professor corrige nome, idade ou personagem (ex.: a criança fez aniversário). */
export const atualizarAlunoSchema = z
  .object({
    nome: entrarSchema.shape.nome.optional(),
    idade: entrarSchema.shape.idade.optional()
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: 'Nada para atualizar' });

export type AtualizarAlunoInput = z.input<typeof atualizarAlunoSchema>;