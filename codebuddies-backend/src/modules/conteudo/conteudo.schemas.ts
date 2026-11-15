import { z } from 'zod';

/**
 * Validação do conteúdo pedagógico (Etapa 6). Os limites são os mesmos das colunas do Oracle:
 * NIVEL.TITULO 50, FASE.TITULO 80, DESAFIO.ENUNCIADO 255, RESPOSTA_CORRETA 100, PONTOS NUMBER(4).
 */

/** Posição (1 a 99). Se não vier, o back coloca no final. */
const ordem = z
  .int('A ordem deve ser um número inteiro')
  .min(1, 'A ordem começa em 1')
  .max(99, 'Ordem máxima: 99');
const id = z.int('ID inválido').positive('ID inválido');

const texto = (campo: string, max: number) =>
  z
    .string({ error: `${campo} é obrigatório` })
    .trim()
    .min(1, `${campo} é obrigatório`)
    .max(max, `${campo}: no máximo ${max} caracteres`);

export const TIPOS_DE_FASE = ['DIGITACAO', 'LOGICA', 'COMPUTACAO_BASICA'] as const;

/** Exige pelo menos um campo no PATCH. */
const algoParaAtualizar = (d: object) => Object.values(d).some((v) => v !== undefined);

// ───────────── Nível ─────────────
export const criarNivelSchema = z.object({
  ordem: ordem.optional(),
  titulo: texto('Título', 50),
  descricao: z.string().trim().max(200, 'Descrição: no máximo 200 caracteres').nullish(),
});
export const atualizarNivelSchema = criarNivelSchema
  .partial()
  .refine(algoParaAtualizar, { message: 'Nada para atualizar' });

// ───────────── Fase ─────────────
export const criarFaseSchema = z.object({
  nivelId: id,
  ordem: ordem.optional(),
  titulo: texto('Título', 80),
  tipo: z.enum(TIPOS_DE_FASE, { error: `Tipo deve ser ${TIPOS_DE_FASE.join(', ')}` }),
});
export const atualizarFaseSchema = criarFaseSchema
  .partial()
  .refine(algoParaAtualizar, { message: 'Nada para atualizar' });

// ───────────── Desafio ─────────────
export const criarDesafioSchema = z.object({
  ordem: ordem.optional(),
  enunciado: texto('Enunciado', 255),
  respostaCorreta: texto('Resposta correta', 100),
  pontos: z
    .int('Pontos deve ser inteiro')
    .min(1, 'Mínimo 1 ponto')
    .max(9999, 'Máximo 9999 pontos')
    .default(100),
});
export const atualizarDesafioSchema = z
  .object({
    ordem: ordem.optional(),
    enunciado: criarDesafioSchema.shape.enunciado.optional(),
    respostaCorreta: criarDesafioSchema.shape.respostaCorreta.optional(),
    pontos: z
      .int('Pontos deve ser inteiro')
      .min(1, 'Mínimo 1 ponto')
      .max(9999, 'Máximo 9999 pontos')
      .optional(),
  })
  .refine(algoParaAtualizar, { message: 'Nada para atualizar' });

export type CriarNivelInput = z.input<typeof criarNivelSchema>;
export type AtualizarNivelInput = z.input<typeof atualizarNivelSchema>;
export type CriarFaseInput = z.input<typeof criarFaseSchema>;
export type AtualizarFaseInput = z.input<typeof atualizarFaseSchema>;
export type CriarDesafioInput = z.input<typeof criarDesafioSchema>;
export type AtualizarDesafioInput = z.input<typeof atualizarDesafioSchema>;