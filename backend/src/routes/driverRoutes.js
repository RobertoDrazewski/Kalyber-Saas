// ============================================================
// FIX 14/07/2026 — BUG PREEXISTENTE (no introducido por los cambios
// de hoy, pero encontrado a partir del reporte "mis conductores
// desaparecieron del panel aunque siguen en la base").
//
// Este archivo era, byte a byte, casi una copia de deviceRoutes.js:
// montaba '/api/drivers' pero enrutaba TODO a devicesController
// (addDevice, getDevices, pairDevice, updateDevice, deleteDevice...)
// en vez de a driversController (getDrivers, updateDriver,
// deleteDriver), que ya existía en el proyecto pero nunca estuvo
// conectado a ninguna ruta real.
//
// Efecto real: GET /api/drivers devolvía filas de la tabla Devices
// (equipos GPS) con esa forma (imei, model, vehicle_id...) en vez de
// filas de Drivers (full_name, dni, license_number...). El front
// (TabConductores.jsx, y el selector de "asignar conductor" de
// TabFlota.jsx) esperaba d.id/d.full_name — con la forma equivocada,
// esos campos venían undefined, así que la lista se veía vacía o con
// entradas en blanco, aunque los conductores seguían intactos en la
// tabla Drivers (por eso aparecían bien haciendo SELECT directo a la
// base, pero no en el panel).
// ============================================================
const express = require('express');
const router = express.Router();
const { getDrivers, updateDriver, deleteDriver } = require('../controllers/driversController');
const { verifyToken } = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/requireRole');

// Alta de choferes: por diseño NO se hace acá (ver nota en
// driversController.js) — se hace desde Usuarios
// (usersController.createUser con role='driver'). Esta ruta solo
// lista, edita y borra.
router.get('/', verifyToken, requireRole('super_admin', 'admin'), getDrivers);
router.patch('/:id', verifyToken, requireRole('super_admin', 'admin'), updateDriver);
router.delete('/:id', verifyToken, requireRole('super_admin', 'admin'), deleteDriver);

module.exports = router;
