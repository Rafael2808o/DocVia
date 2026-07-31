import { z } from 'zod';

export const documentTypeSchema = z.object({
    document_type: z.enum(['contrato', 'exame', 'boleto', 'termo_de_uso', 'outro'], {
        errorMap: () => ({ message: "document_type deve ser: contrato, exame, boleto, termo_de_uso ou outro" }),
    }),
});