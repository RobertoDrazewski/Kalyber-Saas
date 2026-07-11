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
const fuelRoutes = require('./src/routes/fuelRoutes');

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
    // PATCH agregado — lo usan assign-driver, updateVehicle, updateDriver,
    // updateUser. Sin esto, el navegador bloquea el preflight y el fetch
    // ni siquiera llega a intentarse (por eso el error "no se pudo conectar",
    // no era problema de red real).
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
app.use('/api/fuel', fuelRoutes);

app.get('/api/status', (req, res) => {
    res.json({ status: 'Kyber API Online', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;

// El simulador de 6 autos de demo ya NO se inicializa acá. Todo el
// sistema corre solo con datos reales — GPS real (servicio aparte,
// ver gt06Server.js) y ML sobre esos datos reales.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API de Kyber corriendo en el puerto ${PORT}`);
});