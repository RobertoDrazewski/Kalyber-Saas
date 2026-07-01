const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    // 1. Obtenemos el header de autorización
    const authHeader = req.headers['authorization'];
    
    // 2. El formato debe ser "Bearer <token>", así que lo separamos
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(403).json({ 
            error: 'Acceso denegado: Se requiere un token de autenticación.' 
        });
    }

    try {
        // 3. Verificamos que el token sea válido y no haya expirado
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 4. Guardamos los datos del usuario decodificados en la petición
        req.user = decoded; 
        
        // 5. Permiso concedido, pasamos al controlador
        next(); 
    } catch (error) {
        return res.status(401).json({ 
            error: 'Acceso denegado: Token inválido o expirado.' 
        });
    }
};

module.exports = { verifyToken };