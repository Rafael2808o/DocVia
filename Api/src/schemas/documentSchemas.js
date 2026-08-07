import { z } from 'zod';

export const documentTypeSchema = z.object({
    document_type: z.enum(['contrato', 'exame', 'boleto', 'termo_de_uso', 'outro'], {
        errorMap: () => ({ message: "document_type deve ser: contrato, exame, boleto, termo_de_uso ou outro" }),
    }),
});

export const textDocumentSchema = documentTypeSchema.extend({
    text: z.string().trim().min(20, 'Cole ou digite pelo menos 20 caracteres do documento.').max(100_000, 'O texto pode ter no máximo 100.000 caracteres.'),
    name: z.string().trim().min(1).max(255).optional(),
});
