import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { BD } from '../../db.js';
import { validar } from '../middlewares/validar.js';
import { limitadorAuth } from '../middlewares/limitadores.js';
import { registerSchema, loginSchema, refreshSchema } from '../schemas/authSchemas.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { criarRefreshToken, validarRefreshToken, revogarRefreshToken } from '../services/refreshTokenService.js';
import { env } from '../../config/env.js';

const router = Router();
const SECRET_KEY = env.JWT_SECRET;

// Access token de vida curta: se vazar, expira rápido.
// Quem mantém a sessão viva por mais tempo é o refresh token.
const ACCESS_TOKEN_EXPIRA_EM = '15m';

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

    const existe = await BD.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existe.rows.length > 0) {
        throw new AppError('Email já cadastrado', 409);
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const resultado = await BD.query(
        `INSERT INTO users (name, email, password_hash, auth_provider, plan)
         VALUES ($1, $2, $3, 'email', 'free')
         RETURNING id, name, email, plan, created_at`,
        [nome, email, senhaHash]
    );

    return res.status(201).json({ message: 'Usuário criado com sucesso', usuario: resultado.rows[0] });
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
router.post('/login', limitadorAuth, validar(loginSchema), asyncHandler(async (req, res) => {
    const { email, senha } = req.body;

    const resultado = await BD.query(
        'SELECT id, name, email, password_hash, plan FROM users WHERE email = $1',
        [email]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Email ou senha inválidos', 401);
    }

    const usuario = resultado.rows[0];
    const senhaCorreta = usuario.password_hash ? await bcrypt.compare(senha, usuario.password_hash) : false;

    if (!senhaCorreta) {
        throw new AppError('Email ou senha inválidos', 401);
    }

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

    const registro = await validarRefreshToken(refresh_token);
    if (!registro) {
        throw new AppError('Refresh token inválido, expirado ou revogado', 401);
    }

    const resultado = await BD.query('SELECT id, email, plan FROM users WHERE id = $1', [registro.user_id]);
    if (resultado.rows.length === 0) {
        throw new AppError('Usuário não encontrado', 401);
    }

    const accessToken = gerarAccessToken(resultado.rows[0]);
    await revogarRefreshToken(refresh_token);
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

export default router;