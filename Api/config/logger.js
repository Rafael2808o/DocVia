import pino from 'pino';
import { env } from './env.js';

const emDesenvolvimento = env.NODE_ENV !== 'production';

export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-docvia-job-secret"]', 'res.headers.set-cookie'],
        censor: '[REDACTED]',
    },
    transport: emDesenvolvimento
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
        : undefined,
});
