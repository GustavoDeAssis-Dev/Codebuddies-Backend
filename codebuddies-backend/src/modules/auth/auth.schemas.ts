import { z } from 'zod';

// Primeiro limpa (tira espaços, deixa minúsculo), DEPOIS valida o formato de e-mail.
const email = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido'));

export const loginProfessorSchema = z.object({
  email,
  senha: z.string().min(1, 'Digite a senha'),
});

export const cadastrarProfessorSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(80),
  email,
  senha: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres').max(72), // 72 = limite do bcrypt
});

export type LoginProfessorInput = z.input<typeof loginProfessorSchema>;
export type CadastrarProfessorInput = z.input<typeof cadastrarProfessorSchema>;