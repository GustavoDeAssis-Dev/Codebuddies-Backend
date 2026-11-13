import { createApp } from './app.js';
import { env } from './config/env.js';
import { AuthService } from './modules/auth/auth.service.js';
import { criarContexto } from './shared/contexto.js';
import { logger } from './shared/logger.js';
import { criarContextoDoAmbiente, type Contexto } from './shared/contexto.js';

// Conecta no banco escolhido no .env (BANCO=memoria ou BANCO=oracle)
let ctx: Contexto;
try {
  ctx = await criarContextoDoAmbiente();
} catch (erro) {
  logger.fatal(`❌ Não foi possível conectar ao banco: ${(erro as Error).message}`);
  logger.fatal(
    'Confira a rede (FEMA/VPN) e DB_USER, DB_PASSWORD, DB_CONNECT_STRING no .env — ou use BANCO=memoria.',
  );
  process.exit(1);
}
logger.info(
  `🗄️  Banco de dados: ${env.BANCO === 'oracle' ? `Oracle (${env.DB_CONNECT_STRING})` : 'memória'}`,
);

// Garante que o professor do .env exista (no Oracle, só cria na primeira vez)
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

// Encerramento gracioso (Ctrl+C ou parada do serviço): fecha o servidor e a conexão com o banco
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    logger.info(`${signal} recebido, encerrando...`);
    server.close(async () => {
      await ctx.encerrar?.();
      process.exit(0);
    });
  });
}