import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BD } from '../../db.js';
import { validar } from '../middlewares/validar.js';
import { limitadorAuth, verificarBloqueioLogin, registrarFalhaLogin, registrarSucessoLogin } from '../middlewares/limitadores.js';
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from '../schemas/authSchemas.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { criarRefreshToken, consumirRefreshToken, revogarRefreshToken } from '../services/refreshTokenService.js';
import { criarTokenRedefinicao, consumirTokenRedefinicao, enviarEmailRedefinicao } from '../services/passwordResetService.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const router = Router();
const SECRET_KEY = env.JWT_SECRET;

// Access token de vida curta: se vazar, expira rápido.
// Quem mantém a sessão viva por mais tempo é o refresh token.
const ACCESS_TOKEN_EXPIRA_EM = '15m';
// Mantém o tempo de resposta parecido quando o e-mail não existe, reduzindo
// tentativas de enumeração por medição de tempo.
const HASH_SENHA_FALSA = '$2b$10$8bYHtj9tYYQdPWCyIfKcL.6fkZgSsFKc4oizmvS8S9zQ8FzvL05Gq';

function gerarAccessToken(usuario) {
    return jwt.sign(
        { id_usuario: usuario.id, email: usuario.email, plan: usuario.plan },
        SECRET_KEY,
        { expiresIn: ACCESS_TOKEN_EXPIRA_EM }
    );
}

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: ["Autenticação"]
 *     summary: "Cria uma nova conta de usuário"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome, email, senha]
 *             properties:
 *               nome: { type: string, example: "Ricardo" }
 *               email: { type: string, example: "ricardo@email.com" }
 *               senha: { type: string, minLength: 8, example: "senha1234" }
 *     responses:
 *       201: { description: "Usuário criado com sucesso" }
 *       400: { description: "Dados inválidos" }
 *       409: { description: "Email já cadastrado" }
 */
router.post('/register', limitadorAuth, validar(registerSchema), asyncHandler(async (req, res) => {
    const { nome, email, senha } = req.body;

    const senhaHash = await bcrypt.hash(senha, 10);
    try {
        const resultado = await BD.query(
            `INSERT INTO users (name, email, password_hash, auth_provider, plan)
             VALUES ($1, $2, $3, 'email', 'free')
             RETURNING id, name, email, plan, created_at`,
            [nome, email, senhaHash]
        );
        return res.status(201).json({ message: 'Conta criada com sucesso', usuario: resultado.rows[0] });
    } catch (erro) {
        if (erro.code === '23505') {
            throw new AppError('Não foi possível concluir o cadastro. Tente entrar ou recuperar sua senha.', 409);
        }
        throw erro;
    }
}));

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: ["Autenticação"]
 *     summary: "Autentica o usuário e devolve um access token + refresh token"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, senha]
 *             properties:
 *               email: { type: string, example: "ricardo@email.com" }
 *               senha: { type: string, example: "senha1234" }
 *     responses:
 *       200:
 *         description: "Login realizado com sucesso"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Resposta_Login' }
 *       401: { description: "Email ou senha inválidos" }
 */
router.post('/login', limitadorAuth, validar(loginSchema), verificarBloqueioLogin, asyncHandler(async (req, res) => {
    const { email, senha } = req.body;

    const resultado = await BD.query(
        'SELECT id, name, email, password_hash, plan FROM users WHERE email = $1',
        [email]
    );

    if (resultado.rows.length === 0) {
        await bcrypt.compare(senha, HASH_SENHA_FALSA);
        await registrarFalhaLogin(email);
        throw new AppError('Email ou senha inválidos', 401);
    }

    const usuario = resultado.rows[0];
    const senhaCorreta = usuario.password_hash ? await bcrypt.compare(senha, usuario.password_hash) : false;

    if (!senhaCorreta) {
        await registrarFalhaLogin(email);
        throw new AppError('Email ou senha inválidos', 401);
    }

    await registrarSucessoLogin(email);
    const accessToken = gerarAccessToken(usuario);
    const refreshToken = await criarRefreshToken(usuario.id);

    return res.status(200).json({
        message: 'Login realizado com sucesso',
        access_token: accessToken,
        refresh_token: refreshToken,
        usuario: {
            id_usuario: usuario.id,
            nome: usuario.name,
            email: usuario.email,
            plan: usuario.plan,
        },
    });
}));

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: ["Autenticação"]
 *     summary: "Troca um refresh token válido por um novo access token"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: "Novo access token gerado" }
 *       401: { description: "Refresh token inválido, expirado ou revogado" }
 */
router.post('/refresh', validar(refreshSchema), asyncHandler(async (req, res) => {
    const { refresh_token } = req.body;

    const registro = await consumirRefreshToken(refresh_token);
    if (!registro) {
        throw new AppError('Refresh token inválido, expirado ou revogado', 401);
    }

    const resultado = await BD.query('SELECT id, email, plan FROM users WHERE id = $1', [registro.user_id]);
    if (resultado.rows.length === 0) {
        throw new AppError('Usuário não encontrado', 401);
    }

    const accessToken = gerarAccessToken(resultado.rows[0]);
    const novoRefreshToken = await criarRefreshToken(resultado.rows[0].id);
    return res.status(200).json({ access_token: accessToken, refresh_token: novoRefreshToken });
}));

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: ["Autenticação"]
 *     summary: "Revoga um refresh token (logout do dispositivo atual)"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refresh_token]
 *             properties:
 *               refresh_token: { type: string }
 *     responses:
 *       200: { description: "Logout realizado com sucesso" }
 */
router.post('/logout', validar(refreshSchema), asyncHandler(async (req, res) => {
    await revogarRefreshToken(req.body.refresh_token);
    return res.status(200).json({ message: 'Logout realizado com sucesso' });
}));

router.post('/forgot-password', limitadorAuth, validar(forgotPasswordSchema), asyncHandler(async (req, res) => {
    const usuario = await BD.query('SELECT id FROM users WHERE email = $1', [req.body.email]);
    if (usuario.rows[0]) {
        try {
            const token = await criarTokenRedefinicao(usuario.rows[0].id);
            await enviarEmailRedefinicao(req.body.email, token);
        } catch (erro) {
            // A resposta permanece idêntica para e-mails existentes e inexistentes,
            // inclusive quando o provedor falha, evitando enumeração de contas.
            logger.error({ err: erro, userId: usuario.rows[0].id }, 'Falha ao enviar recuperação de senha');
        }
    }
    return res.status(202).json({ message: 'Se este e-mail estiver cadastrado, você receberá instruções para redefinir a senha.' });
}));

router.post('/reset-password', validar(resetPasswordSchema), asyncHandler(async (req, res) => {
    const senhaHash = await bcrypt.hash(req.body.senha, 10);
    const cliente = await BD.connect();
    try {
        await cliente.query('BEGIN');
        const userId = await consumirTokenRedefinicao(req.body.token, cliente);
        if (!userId) throw new AppError('Link inválido ou expirado', 400);
        await cliente.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [senhaHash, userId]);
        await cliente.query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [userId]);
        await cliente.query('COMMIT');
    } catch (erro) {
        await cliente.query('ROLLBACK').catch(() => undefined);
        throw erro;
    } finally {
        cliente.release();
    }
    return res.status(200).json({ message: 'Senha atualizada com sucesso. Entre novamente.' });
}));

export default router;
