import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
 
const SECRET_KEY = env.JWT_SECRET;
 
export function autenticarToken(req, res, next) {
    const cabecalho = req.headers['authorization'];
    const [tipo, token] = typeof cabecalho === 'string' ? cabecalho.split(' ') : [];
 
    if (tipo !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Token não fornecido' });
    }
 
    jwt.verify(token, SECRET_KEY, (err, usuario) => {
        if (err) {
            return res.status(403).json({ message: 'Token inválido ou expirado' });
        }
 
        req.usuario = usuario;
        next();
    });
}
