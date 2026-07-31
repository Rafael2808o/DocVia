import pino from 'pino';
import { env } from './env.js';

const emDesenvolvimento = env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: emDesenvolvimento
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
});