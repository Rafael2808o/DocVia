import { z } from 'zod';

export const checkoutSchema = z.object({
    payment_method: z.enum(['card', 'boleto']),
    customer_name: z.string().min(3, 'customer_name precisa ter pelo menos 3 caracteres'),
    customer_email: z.string().email('customer_email precisa ser um email válido'),
});

export const confirmPaymentSchema = z.object({
    payment_intent_id: z.string().min(1, 'payment_intent_id é obrigatório'),
});
