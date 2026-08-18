import { z } from 'zod';

const sourceSchema = z.object({
  position: z.number().int().nonnegative(), page: z.number().int().positive().nullable(),
  clause: z.string().nullable(), annex: z.string().nullable(), text: z.string(),
  table: z.number().int().positive().nullable().optional(), row: z.number().int().positive().nullable().optional(), column: z.number().int().positive().nullable().optional(),
});

export const contractEntitySchema = z.object({
  id: z.string().min(1), type: z.string().min(1), semantic_role: z.string().min(1),
  data_type: z.enum(['money', 'percentage', 'rule']), value: z.union([z.number().finite(), z.string()]),
  currency: z.string().nullable(), scope: z.string().min(1), period: z.string().nullable(),
  condition: z.string().nullable(), confidence: z.number().min(0).max(1), source: sourceSchema,
  relationships: z.array(z.string()),
}).passthrough();

export const contractAnalysisSchema = z.object({
  summary: z.string(), financial_items: z.array(contractEntitySchema), relationships: z.array(z.object({ id: z.string(), type: z.string(), status: z.string() }).passthrough()),
  calculations: z.array(z.object({ type: z.string(), status: z.string(), source: sourceSchema }).passthrough()),
  conflicts: z.array(z.object({ type: z.string(), severity: z.string(), confidence: z.number().min(0).max(1) }).passthrough()),
  warnings: z.array(z.object({ descricao: z.string(), prioridade: z.enum(['informativo', 'atencao', 'critico']), confidence: z.number().min(0).max(1) }).passthrough()),
  provenance_version: z.number().int().positive(),
}).passthrough();

export function validateContractAnalysis(result) {
  const validated = contractAnalysisSchema.parse(result);
  for (const entity of validated.financial_items) {
    if (entity.data_type === 'percentage' && entity.currency) throw new Error(`Invariante violada: percentual ${entity.id} possui moeda`);
    if (entity.type === 'EXCHANGE_RATE' && entity.currency) throw new Error(`Invariante violada: cotação ${entity.id} foi marcada como dinheiro`);
    if (entity.type === 'CREDIT' && Number(entity.value) > 0) throw new Error(`Invariante violada: crédito ${entity.id} possui polaridade positiva`);
  }
  for (const conflict of validated.conflicts) if (conflict.severity === 'HIGH') {
    if (conflict.confidence < 0.8) throw new Error('Invariante violada: alerta alto sem confiança suficiente');
    if (!JSON.stringify(conflict).includes('"source"')) throw new Error('Invariante violada: alerta alto sem evidência de origem');
  }
  return validated;
}
