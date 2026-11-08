import { z } from 'zod';
import { cadastrarProfessorSchema } from '../auth/auth.schemas.js';

export const trocarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Digite a senha atual'),
  novaSenha: cadastrarProfessorSchema.shape.senha, // mesmas regras do cadastro (8 a 72 caracteres)
});

export const alterarAtivoSchema = z.object({
  ativo: z.boolean({ error: 'Informe ativo: true ou false' }),
});

export type TrocarSenhaInput = z.input<typeof trocarSenhaSchema>;
export type AlterarAtivoInput = z.input<typeof alterarAtivoSchema>;