import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

const app = createApp();

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
