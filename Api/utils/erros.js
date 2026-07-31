// Erro "esperado" da aplicação (ex: email já cadastrado, senha inválida).
// Diferente de um erro inesperado (bug, banco fora do ar), esse tem um
// statusCode definido e uma mensagem segura pra mostrar ao usuário.
export class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
    }
}
 
// Envolve uma rota async: se a Promise rejeitar (erro de banco, erro de IA,
// um "throw new AppError(...)" dentro da rota, etc), o erro é encaminhado
// pro middleware de tratamento de erros via next(err), em vez de precisar
// de um try/catch repetido em cada rota.
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
 