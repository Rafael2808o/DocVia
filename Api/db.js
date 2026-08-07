import { Pool } from 'pg';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

// IMPORTANTE: precisa do "export" aqui na frente, senão as outras
// rotas (auth.js, documents.js...) não conseguem importar o BD.
export const BD = new Pool({
    ...(env.DATABASE_URL ? { connectionString: env.DATABASE_URL } : {
        user: env.DB_USER,
        host: env.DB_HOST,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        port: env.DB_PORT,
    }),
    ssl: env.DB_SSL ? { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED } : false,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
});

BD.on('error', (error) => logger.error({ err: error }, 'Erro inesperado em conexão ociosa do banco'));

export const testarConexao = async () => {
    try {
        const cliente = await BD.connect(); // Realiza a conexão
        logger.info('Conexão com o banco estabelecida');
        cliente.release(); // Libera a conexão
    } catch (error) {
        logger.error({ err: error }, 'Erro ao conectar com o banco');
        throw error;
    }
};
