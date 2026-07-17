// ============================================================
// Script de migración manual — corré esto UNA VEZ desde tu terminal:
//
//   cd backend
//   node run-migration-scanner.js
//
// Usa el mismo DB_URL que ya tenés en backend/.env — no necesita
// instalar nada nuevo (mysql2 ya está en tus node_modules porque lo
// usa el backend). Corre cada sentencia POR SEPARADO y te dice
// exactamente qué pasó en cada una — así no dependemos más de
// TablePlus ni de adivinar si algo se aplicó o no.
// ============================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

const STATEMENTS = [
  ["Agregar rol 'taller' al ENUM de Users.role", `ALTER TABLE Users MODIFY COLUMN role ENUM('super_admin','admin','driver','taller') DEFAULT NULL`],
  ["Corregir info@puma-code.com a role='taller' (quedó mal de una prueba anterior)", `UPDATE Users SET role = 'taller' WHERE email = 'info@puma-code.com' AND role = 'admin'`],
  ["Crear Workshops (si no existe)", `
    CREATE TABLE IF NOT EXISTS Workshops (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        owner_user_id INT NOT NULL,
        plan ENUM('scanner_mensual') NOT NULL DEFAULT 'scanner_mensual',
        subscription_status ENUM('trial','active','past_due','canceled') NOT NULL DEFAULT 'trial',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`],
  ["Agregar Workshops.cuit", `ALTER TABLE Workshops ADD COLUMN cuit VARCHAR(15) NULL`],
  ["Agregar Workshops.owner_name", `ALTER TABLE Workshops ADD COLUMN owner_name VARCHAR(150) NULL`],
  ["Agregar Workshops.phone", `ALTER TABLE Workshops ADD COLUMN phone VARCHAR(30) NULL`],
  ["Agregar Workshops.email", `ALTER TABLE Workshops ADD COLUMN email VARCHAR(150) NULL`],
  ["Agregar Workshops.address", `ALTER TABLE Workshops ADD COLUMN address VARCHAR(255) NULL`],

  ["Crear ScannerDevices", `
    CREATE TABLE IF NOT EXISTS ScannerDevices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_uid VARCHAR(64) NOT NULL UNIQUE,
        workshop_id INT NULL,
        device_token_hash CHAR(64) NULL,
        label VARCHAR(100) NULL,
        firmware_version VARCHAR(30) NULL,
        mode ENUM('scanner','simulator') NOT NULL DEFAULT 'scanner',
        last_seen_at TIMESTAMP NULL,
        paired_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`],

  ["Crear ScanVehicles", `
    CREATE TABLE IF NOT EXISTS ScanVehicles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workshop_id INT NOT NULL,
        vin VARCHAR(17) NULL,
        brand VARCHAR(60) NULL,
        model VARCHAR(80) NULL,
        model_year SMALLINT NULL,
        plate_photo_url LONGTEXT NULL,
        plate_text VARCHAR(15) NULL,
        customer_label VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`],
  ["Corregir ScanVehicles.plate_photo_url a LONGTEXT", `ALTER TABLE ScanVehicles MODIFY COLUMN plate_photo_url LONGTEXT NULL`],

  ["Crear DiagnosticSessions", `
    CREATE TABLE IF NOT EXISTS DiagnosticSessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        scan_vehicle_id INT NOT NULL,
        scanner_device_id INT NOT NULL,
        mode ENUM('scanner','simulator') NOT NULL DEFAULT 'scanner',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        status ENUM('en_curso','finalizada') NOT NULL DEFAULT 'en_curso'
    )`],

  ["Crear DiagnosticFrames", `
    CREATE TABLE IF NOT EXISTS DiagnosticFrames (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        recorded_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
        protocol ENUM('CAN','ISO15765','KLINE','J1850','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
        can_id VARCHAR(10) NULL,
        raw_frame_hex VARCHAR(64) NOT NULL,
        decoded_pid VARCHAR(10) NULL,
        decoded_value DECIMAL(12,3) NULL,
        decoded_unit VARCHAR(20) NULL
    )`],

  ["Crear DiagnosticDTC", `
    CREATE TABLE IF NOT EXISTS DiagnosticDTC (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id INT NOT NULL,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        raw_code_hex VARCHAR(40) NULL,
        decoded_code VARCHAR(10) NULL,
        description_guess VARCHAR(255) NULL,
        confirmed_by_mechanic TINYINT(1) NULL DEFAULT NULL,
        mechanic_correction VARCHAR(255) NULL
    )`],
  ["Agregar DiagnosticDTC.source", `ALTER TABLE DiagnosticDTC ADD COLUMN source ENUM('local','remote','unknown') NOT NULL DEFAULT 'unknown'`],

  // Las dos FK (workshop_id -> Workshops, scan_vehicle_id/scanner_device_id
  // -> ScanVehicles/ScannerDevices, session_id -> DiagnosticSessions) se
  // agregan DESPUÉS de crear todas las tablas — si las poníamos dentro
  // del primer CREATE TABLE de cada una, fallarían porque la tabla
  // referenciada todavía no existía en ese punto de la secuencia.
  ["Agregar FK ScannerDevices -> Workshops", `ALTER TABLE ScannerDevices ADD CONSTRAINT fk_scannerdevices_workshop FOREIGN KEY (workshop_id) REFERENCES Workshops(id) ON DELETE SET NULL`],
  ["Agregar FK ScanVehicles -> Workshops", `ALTER TABLE ScanVehicles ADD CONSTRAINT fk_scanvehicles_workshop FOREIGN KEY (workshop_id) REFERENCES Workshops(id) ON DELETE CASCADE`],
  ["Agregar FK DiagnosticSessions -> ScanVehicles", `ALTER TABLE DiagnosticSessions ADD CONSTRAINT fk_diagsessions_vehicle FOREIGN KEY (scan_vehicle_id) REFERENCES ScanVehicles(id) ON DELETE CASCADE`],
  ["Agregar FK DiagnosticSessions -> ScannerDevices", `ALTER TABLE DiagnosticSessions ADD CONSTRAINT fk_diagsessions_device FOREIGN KEY (scanner_device_id) REFERENCES ScannerDevices(id)`],
  ["Agregar FK DiagnosticFrames -> DiagnosticSessions", `ALTER TABLE DiagnosticFrames ADD CONSTRAINT fk_diagframes_session FOREIGN KEY (session_id) REFERENCES DiagnosticSessions(id) ON DELETE CASCADE`],
  ["Agregar FK DiagnosticDTC -> DiagnosticSessions", `ALTER TABLE DiagnosticDTC ADD CONSTRAINT fk_diagdtc_session FOREIGN KEY (session_id) REFERENCES DiagnosticSessions(id) ON DELETE CASCADE`],

  ["Agregar Workshops.owner_user_id -> Users (FK)", `ALTER TABLE Workshops ADD CONSTRAINT fk_workshops_owner FOREIGN KEY (owner_user_id) REFERENCES Users(id)`],
];

async function main() {
    if (!process.env.DB_URL) {
        console.error('❌ No encontré DB_URL — corré este script desde la carpeta backend/ (donde está tu .env)');
        process.exit(1);
    }

    const connection = await mysql.createConnection({ uri: process.env.DB_URL });
    console.log('✅ Conectado a la base. Corriendo', STATEMENTS.length, 'sentencias...\n');

    for (const [label, sql] of STATEMENTS) {
        try {
            await connection.query(sql);
            console.log(`✅ ${label}`);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME' || err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_ENTRY') {
                console.log(`⏭️  ${label} — ya existía, sin cambios (${err.code})`);
            } else if (err.code === 'ER_FK_DUP_NAME' || err.message?.includes('Duplicate')) {
                console.log(`⏭️  ${label} — ya existía (${err.code || 'duplicado'})`);
            } else {
                console.log(`❌ ${label} — ERROR REAL: [${err.code}] ${err.message}`);
            }
        }
    }

    console.log('\n--- Estructura final de Workshops ---');
    const [cols] = await connection.query('DESCRIBE Workshops');
    console.table(cols.map(c => ({ campo: c.Field, tipo: c.Type, nulo: c.Null })));

    console.log('\n--- Tablas del scanner presentes ---');
    const [tables] = await connection.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('Workshops','ScannerDevices','ScanVehicles','DiagnosticSessions','DiagnosticFrames','DiagnosticDTC')`
    );
    console.table(tables);

    await connection.end();
    console.log('\n🎉 Listo.');
}

main().catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
});
