// Recebe um schema do Zod e devolve um middleware pronto pra usar na rota.
// Se os dados não baterem com o schema, responde 400 já com a lista de
// campos inválidos, sem nem chegar a executar a lógica da rota.
export function validar(schema) {
    return (req, res, next) => {
        const resultado = schema.safeParse(req.body);

        if (!resultado.success) {
            const erros = resultado.error.issues.map((issue) => ({
                campo: issue.path.join('.') || '(corpo da requisição)',
                mensagem: issue.message,
            }));
            return res.status(400).json({ message: 'Dados inválidos', erros });
        }

        // Substitui req.body pelos dados já validados/normalizados
        // (ex: email em minúsculo, espaços removidos)
        req.body = resultado.data;
        next();
    };
}