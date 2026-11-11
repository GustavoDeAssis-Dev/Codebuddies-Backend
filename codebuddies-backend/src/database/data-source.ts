import 'reflect-metadata'; // obrigatório para as anotações (@Entity, @Column...) funcionarem
import { DataSource } from 'typeorm';
import { env } from '../config/env.js';

/**
 * DataSource = a "classe de contexto" do TypeORM (equivalente ao DbContext do Entity Framework).
 * Guarda a conexão com o Oracle e a lista de entidades (tabelas) que o sistema conhece.
 */
export function criarDataSource(): DataSource {
  const { DB_USER, DB_PASSWORD, DB_CONNECT_STRING } = env;
  if (!DB_USER || !DB_PASSWORD || !DB_CONNECT_STRING) {
    throw new Error('Configure DB_USER, DB_PASSWORD e DB_CONNECT_STRING no .env para usar o Oracle.');
  }

  return new DataSource({
    type: 'oracle',
    username: DB_USER,
    password: DB_PASSWORD,
    connectString: DB_CONNECT_STRING,

    // Parte 3: aqui entram as entidades (uma classe por tabela)
    entities: [],

    // NUNCA deixar o TypeORM criar/alterar tabelas sozinho:
    // quem cuida da estrutura do banco é o Leonardo (scripts SQL).
    synchronize: false,

    logging: env.DB_LOGGING,
  });
}