import { Router } from 'express';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { LIMITES_POR_PLANO } from '../services/usoService.js';
import { buscarDetalhesDoPlano } from '../services/billingService.js';
import { asyncHandler } from '../../utils/erros.js';

const router = Router();

/**
 * @swagger
 * /usage:
 *   get:
 *     tags: ["Uso"]
 *     summary: "Retorna quantas análises o usuário já fez hoje e o limite do plano dele"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Dados de uso obtidos com sucesso" }
 */
router.get('/', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
            `SELECT COUNT(*) FROM usage_logs
             WHERE user_id = $1
               AND action = 'analysis_created'
               AND created_at >= NOW() - INTERVAL '1 day'`,
            [req.usuario.id_usuario]
        );

        const usoHoje = parseInt(resultado.rows[0].count, 10);
        const limite = LIMITES_POR_PLANO[req.usuario.plan] ?? LIMITES_POR_PLANO.free;
        const plano = buscarDetalhesDoPlano(req.usuario.plan);

    return res.status(200).json({
            uso_hoje: usoHoje,
            limite_diario: limite,
            restante: Math.max(limite - usoHoje, 0),
            plan_details: plano,
    });
}));

export default router;