import { createApp } from './app.js';
import { env } from './config/env.js';
import { AuthService } from './modules/auth/auth.service.js';
import { criarContexto } from './shared/contexto.js';
import { logger } from './shared/logger.js';

const ctx = criarContexto();

// Cria o professor inicial definido no .env (enquanto o banco é em memória)
if (env.PROFESSOR_INICIAL_EMAIL && env.PROFESSOR_INICIAL_SENHA) {
  await new AuthService(ctx).garantirProfessorInicial({
    nome: env.PROFESSOR_INICIAL_NOME ?? 'Professor',
    email: env.PROFESSOR_INICIAL_EMAIL,
    senha: env.PROFESSOR_INICIAL_SENHA,
  });
  logger.info(`👩‍🏫 Professor inicial disponível: ${env.PROFESSOR_INICIAL_EMAIL}`);
}

const app = createApp(ctx);

// HOST 0.0.0.0 permite que os computadores do laboratório acessem o servidor
// do professor pela rede local (ex.: http://192.168.0.10:3333).
const server = app.listen(env.PORT, env.HOST, () => {
  logger.info(`🚀 CodeBuddies API rodando em http://${env.HOST}:${env.PORT}/api`);
});

// Encerramento gracioso (Ctrl+C ou parada do serviço)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} recebido, encerrando...`);
    server.close(() => process.exit(0));
  });
}
