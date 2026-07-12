const mysql = require('mysql2/promise');
require('dotenv').config();

// Creamos el pool de conexiones apuntando a tu variable de entorno DB_URL
const pool = mysql.createPool({
    uri: process.env.DB_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificación de conexión inicial
pool.getConnection()
    .then(connection => {
        console.log('✅ Kalyber Backend conectado a la BD de Railway');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error conectando a la BD:', err.message);
    });

module.exports = pool;