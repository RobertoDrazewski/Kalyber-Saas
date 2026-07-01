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

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // subida de fotos como base64 desde Flota

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/devices', deviceRoutes);

app.get('/api/status', (req, res) => {
    res.json({ status: 'Kyber API Online', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 API de Kyber corriendo en el puerto ${PORT}`);

    // El simulador corre en el mismo proceso, aparte del pipeline de
    // datos reales (telemetryIngestReal). Conviven sin pisarse: los
    // autos reales que vayas dando de alta usan source='real', los
    // 6 de demo usan source='simulated'. Se puede apagar con
    // SIMULATOR_ENABLED=false en el .env cuando ya no lo necesites.
    if (process.env.SIMULATOR_ENABLED !== 'false') {
        const simulator = require('./src/services/simulator');
        simulator.start().catch(err => console.error('❌ Error iniciando simulador:', err.message));
    }
});
