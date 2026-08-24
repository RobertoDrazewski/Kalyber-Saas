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
const contactRoutes = require('./src/routes/contactRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const fuelroutes = require('./src/routes/fuelroutes');
const apiKeysRoutes = require('./src/routes/apiKeysRoutes');
const publicApiRoutes = require('./src/routes/publicApiRoutes');
const geofenceRoutes = require('./src/routes/geofenceRoutes'); // [NUEVO] crear/listar/borrar geocercas
const scannerRoutes = require('./src/routes/scannerRoutes'); // [NUEVO 17/07/2026] producto Kalyber Scanner (talleres/mecánicos)
const internalRoutes = require('./src/routes/internalRoutes'); // [NUEVO] estado agregado de la flota, para el panel de Asistentes de Puma Code
const pool = require('./src/config/database');
const app = express();

// Confía en el primer proxy (Railway) — necesario para el rate limit
app.set('trust proxy', 1);

const corsOptions = {
    origin: [
        'https://kalyber.com.ar',
        'https://www.kalyber.com.ar',
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '5mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/quote-chat', quoteChatRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/fuel', fuelroutes);
app.use('/api/apikeys', apiKeysRoutes);
app.use('/api/geofences', geofenceRoutes); // [NUEVO]
app.use('/api/scanner', scannerRoutes); // [NUEVO 17/07/2026] producto Kalyber Scanner — endpoints propios + /internal/diagnostics-log para el ESP32
app.use('/api/v1', publicApiRoutes); // API pública para terceros, autenticada con API key (no JWT)
app.use('/internal', internalRoutes); // Estado agregado para el panel de Asistentes de Puma Code (secreto compartido, no JWT ni API key de cliente)

app.get('/api/status', (req, res) => {
    res.json({ status: 'Kyber API Online', timestamp: new Date() });
});
app.get('/api/db-ping', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, timestamp: new Date() });
    } catch (error) {
        console.error('[db-ping] Error consultando la BD:', error.message);
        res.status(500).json({ ok: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API de Kalyber.com.ar corriendo en el puerto ${PORT}`);
});