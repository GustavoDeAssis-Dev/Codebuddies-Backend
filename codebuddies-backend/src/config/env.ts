import { z } from 'zod';

/**
 * Lê e valida as variáveis de ambiente uma única vez, na subida da aplicação.
 * Se algo estiver faltando ou inválido, o servidor nem sobe — falha cedo e com mensagem clara.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  HOST: z.string().default('0.0.0.0'),
  // Origens permitidas para o front-end (Angular), separadas por vírgula.
  CORS_ORIGIN: z.string().default('http://localhost:4200'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
   // Autenticação (Etapa 3)
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres'),
  JWT_EXPIRACAO_PROFESSOR: z.string().default('8h'),
  JWT_EXPIRACAO_ALUNO: z.string().default('4h'),
  // Professor criado automaticamente ao subir o servidor (enquanto não há banco)
  PROFESSOR_INICIAL_NOME: z.string().optional(),
  PROFESSOR_INICIAL_EMAIL: z.email().optional(),
  PROFESSOR_INICIAL_SENHA: z.string().min(8).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variáveis de ambiente inválidas:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;