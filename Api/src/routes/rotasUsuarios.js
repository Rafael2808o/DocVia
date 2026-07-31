import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { AppError, asyncHandler } from '../../utils/erros.js';

const router = Router();

/**
 * @swagger
 * /users/me:
 *   get:
 *     tags: ["Usuários"]
 *     summary: "Retorna os dados do usuário autenticado"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Dados obtidos com sucesso" }
 *       401: { description: "Token não fornecido" }
 *       403: { description: "Token inválido ou expirado" }
 */
router.get('/me', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
            'SELECT id, name, email, plan, created_at FROM users WHERE id = $1',
            [req.usuario.id_usuario]
        );

    if (resultado.rows.length === 0) {
        throw new AppError('Usuário não encontrado', 404);
    }

    return res.status(200).json(resultado.rows[0]);
}));

export default router;