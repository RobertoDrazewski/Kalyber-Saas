require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const vehicleRoutes = require('./src/routes/vehicleRoutes');
const telemetryRoutes = require('./src/routes/telemetryRoutes');
const tripRoutes = require('./src/routes/tripRoutes');
const driverRoutes = require('./src/routes/driverRoutes');
const maintenanceRoutes = require('./src/routes/maintenanceRoutes');
const deviceRoutes = require('./src/routes/deviceRoutes');
const quoteChatRoutes = require('./src/routes/quoteChatRoutes');
const contactRoutes = require('./src/routes/contactRoutes'); // NUEVA RUTA DE CONTACTO

const app = express();

// Configuración de CORS
const corsOptions = {
    origin: [
        'https://kalyber.com.ar',
        'https://www.kalyber.com.ar', 
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Middlewares
app.use(express.json({ limit: '5mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/quote-chat', quoteChatRoutes);
app.use('/api/contact', contactRoutes); // APLICACIÓN DE LA NUEVA RUTA

// Ruta de estado / Health check
app.get('/api/status', (req, res) => {
    res.json({ status: 'Kyber API Online', timestamp: new Date() });
});

// Inicialización del servidor
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API de Kyber corriendo en el puerto ${PORT}`);

    // Inicialización del simulador
    if (process.env.SIMULATOR_ENABLED !== 'false') {
        const simulator = require('./src/services/simulator');
        simulator.start().catch(err => console.error('❌ Error iniciando simulador:', err.message));
    }
});