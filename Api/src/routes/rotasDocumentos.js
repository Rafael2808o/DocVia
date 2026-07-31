import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { BD } from '../../db.js';
import { autenticarToken } from '../middlewares/autenticacao.js';
import { validar } from '../middlewares/validar.js';
import { documentTypeSchema } from '../schemas/documentSchemas.js';
import { AppError, asyncHandler } from '../../utils/erros.js';
import { salvarArquivo, removerArquivo, nomeArquivoDaUrl } from '../services/storageService.js';
import { extrairTexto } from '../services/documentTextService.js';
import { env } from '../../config/env.js';

const router = Router();

const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
            return cb(new AppError('Tipo de arquivo não permitido. Envie PDF, JPG ou PNG.', 400));
        }
        cb(null, true);
    },
});

/**
 * @swagger
 * /documents:
 *   post:
 *     tags: ["Documentos"]
 *     summary: "Envia um novo documento (contrato, exame, boleto, termo de uso...)"
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               arquivo: { type: string, format: binary }
 *               document_type:
 *                 type: string
 *                 enum: [contrato, exame, boleto, termo_de_uso, outro]
 *     responses:
 *       201: { description: "Documento enviado com sucesso" }
 *       400: { description: "Arquivo ausente, tipo de arquivo inválido ou document_type inválido" }
 */
router.post(
    '/',
    autenticarToken,
    upload.single('arquivo'),
    validar(documentTypeSchema),
    asyncHandler(async (req, res) => {
        const { document_type } = req.body;

        if (!req.file) {
            throw new AppError('Nenhum arquivo enviado', 400);
        }

        const arquivoSalvo = await salvarArquivo(req.file);
        const textoExtraido = await extrairTexto(req.file);
        const status = textoExtraido ? 'done' : 'pending';

        try {
            const resultado = await BD.query(
                `INSERT INTO documents (user_id, original_name, document_type, storage_url, extracted_text, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
                [req.usuario.id_usuario, req.file.originalname, document_type, arquivoSalvo.url, textoExtraido, status]
            );

            return res.status(201).json({ message: 'Documento enviado com sucesso', documento: resultado.rows[0] });
        } catch (error) {
            await removerArquivo(arquivoSalvo.caminho);
            throw error;
        }
    })
);

/**
 * @swagger
 * /documents:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Lista os documentos do usuário autenticado"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: "Lista de documentos" }
 */
router.get('/', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
        [req.usuario.id_usuario]
    );
    return res.status(200).json(resultado.rows);
}));

/**
 * @swagger
 * /documents/{id}:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Retorna os detalhes de um documento"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Documento encontrado" }
 *       404: { description: "Documento não encontrado" }
 */
router.get('/:id', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    return res.status(200).json(resultado.rows[0]);
}));

/**
 * @swagger
 * /documents/{id}/file:
 *   get:
 *     tags: ["Documentos"]
 *     summary: "Baixa o arquivo original do documento"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Arquivo original" }
 *       404: { description: "Documento ou arquivo não encontrado" }
 */
router.get('/:id/file', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'SELECT original_name, storage_url FROM documents WHERE id = $1 AND user_id = $2',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    const nomeArquivo = nomeArquivoDaUrl(resultado.rows[0].storage_url);
    if (!nomeArquivo) throw new AppError('Arquivo do documento não encontrado', 404);

    return res.sendFile(nomeArquivo, {
        root: path.resolve(env.STORAGE_DIR),
        headers: { 'Content-Disposition': `attachment; filename="${resultado.rows[0].original_name.replace(/"/g, '')}"` },
    });
}));

/**
 * @swagger
 * /documents/{id}:
 *   delete:
 *     tags: ["Documentos"]
 *     summary: "Remove um documento (e suas análises, em cascata)"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200: { description: "Documento removido com sucesso" }
 *       404: { description: "Documento não encontrado" }
 */
router.delete('/:id', autenticarToken, asyncHandler(async (req, res) => {
    const resultado = await BD.query(
        'DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING id',
        [req.params.id, req.usuario.id_usuario]
    );

    if (resultado.rows.length === 0) {
        throw new AppError('Documento não encontrado', 404);
    }

    return res.status(200).json({ message: 'Documento removido com sucesso' });
}));

export default router;