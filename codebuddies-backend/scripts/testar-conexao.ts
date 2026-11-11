/**
 * Testa a conexão com o Oracle e lista as tabelas do usuário.
 * Uso: npm run db:testar
 */
import { criarDataSource } from '../src/database/data-source.js';

const ds = criarDataSource();

try {
  await ds.initialize();
  console.log('✅ Conectado ao Oracle!\n');

  const [info] = await ds.query(
    `SELECT USER AS USUARIO, TO_CHAR(SYSDATE, 'DD/MM/YYYY HH24:MI') AS AGORA FROM DUAL`,
  );
  console.log(`Usuário: ${info.USUARIO} · Data/hora do servidor: ${info.AGORA}\n`);

  const tabelas: { TABLE_NAME: string }[] = await ds.query(
    `SELECT TABLE_NAME FROM USER_TABLES ORDER BY TABLE_NAME`,
  );
  console.log(`Tabelas encontradas (${tabelas.length}):`);
  for (const t of tabelas) console.log(`  - ${t.TABLE_NAME}`);
} catch (erro) {
  console.error('❌ Não foi possível conectar:', (erro as Error).message);
  console.error(`
Verifique:
  1. Você está na rede da FEMA (ou na VPN)? Servidores de faculdade costumam aceitar só a rede interna.
  2. DB_USER, DB_PASSWORD e DB_CONNECT_STRING no .env estão corretos?
  3. O formato do DB_CONNECT_STRING é servidor:porta/serviço (ex.: oracle.fema.edu.br:1521/ORCL)?`);
  process.exitCode = 1;
} finally {
  if (ds.isInitialized) await ds.destroy();
}