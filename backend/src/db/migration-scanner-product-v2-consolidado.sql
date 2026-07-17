-- ============================================================
-- KALYBER SCANNER — script consolidado y RE-CORRIBLE.
-- Podés pegar esto entero las veces que haga falta sin miedo a
-- romper nada: crea lo que falte, y corrige columnas que hayan
-- quedado con una versión vieja del esquema (por haber corrido
-- migraciones anteriores a medio camino mientras lo iba ajustando).
-- ============================================================

-- ---- 1) Talleres ----
CREATE TABLE IF NOT EXISTS Workshops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    cuit VARCHAR(15) NULL,
    owner_name VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,
    address VARCHAR(255) NULL,
    owner_user_id INT NOT NULL,
    plan ENUM('scanner_mensual') NOT NULL DEFAULT 'scanner_mensual',
    subscription_status ENUM('trial','active','past_due','canceled') NOT NULL DEFAULT 'trial',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_workshops_owner FOREIGN KEY (owner_user_id) REFERENCES Users(id)
);
ALTER TABLE Workshops
    ADD COLUMN IF NOT EXISTS cuit VARCHAR(15) NULL,
    ADD COLUMN IF NOT EXISTS owner_name VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS address VARCHAR(255) NULL;

-- ---- 2) Equipos ESP32 ----
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scannerdevices_workshop FOREIGN KEY (workshop_id) REFERENCES Workshops(id) ON DELETE SET NULL
);

-- ---- 3) Autos escaneados ----
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_scanvehicles_workshop FOREIGN KEY (workshop_id) REFERENCES Workshops(id) ON DELETE CASCADE,
    INDEX idx_scanvehicles_vin (vin)
);
-- Por si la tabla ya existía con plate_photo_url como VARCHAR/TEXT
-- (versión vieja) — una foto en base64 pesa mucho más que 255/65535
-- caracteres y quedaría truncada/rechazada.
ALTER TABLE ScanVehicles MODIFY COLUMN plate_photo_url LONGTEXT NULL;

-- ---- 4) Sesiones de diagnóstico ----
CREATE TABLE IF NOT EXISTS DiagnosticSessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scan_vehicle_id INT NOT NULL,
    scanner_device_id INT NOT NULL,
    mode ENUM('scanner','simulator') NOT NULL DEFAULT 'scanner',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    status ENUM('en_curso','finalizada') NOT NULL DEFAULT 'en_curso',
    CONSTRAINT fk_diagsessions_vehicle FOREIGN KEY (scan_vehicle_id) REFERENCES ScanVehicles(id) ON DELETE CASCADE,
    CONSTRAINT fk_diagsessions_device FOREIGN KEY (scanner_device_id) REFERENCES ScannerDevices(id),
    INDEX idx_diagsessions_vehicle (scan_vehicle_id)
);

-- ---- 5) Tramas crudas (para más adelante, cuando el firmware las mande) ----
CREATE TABLE IF NOT EXISTS DiagnosticFrames (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    recorded_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
    protocol ENUM('CAN','ISO15765','KLINE','J1850','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    can_id VARCHAR(10) NULL,
    raw_frame_hex VARCHAR(64) NOT NULL,
    decoded_pid VARCHAR(10) NULL,
    decoded_value DECIMAL(12,3) NULL,
    decoded_unit VARCHAR(20) NULL,
    CONSTRAINT fk_diagframes_session FOREIGN KEY (session_id) REFERENCES DiagnosticSessions(id) ON DELETE CASCADE,
    INDEX idx_diagframes_session_time (session_id, recorded_at)
);

-- ---- 6) DTCs detectados ----
CREATE TABLE IF NOT EXISTS DiagnosticDTC (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_code_hex VARCHAR(40) NULL,
    decoded_code VARCHAR(10) NULL,
    description_guess VARCHAR(255) NULL,
    source ENUM('local','remote','unknown') NOT NULL DEFAULT 'unknown',
    confirmed_by_mechanic TINYINT(1) NULL DEFAULT NULL,
    mechanic_correction VARCHAR(255) NULL,
    CONSTRAINT fk_diagdtc_session FOREIGN KEY (session_id) REFERENCES DiagnosticSessions(id) ON DELETE CASCADE
);
-- Por si la tabla ya existía con la versión vieja (raw_code_hex
-- obligatorio, sin columna source) — el firmware real no manda
-- raw_code_hex, así que si sigue en NOT NULL, CADA diagnóstico real
-- se va a rechazar.
ALTER TABLE DiagnosticDTC MODIFY COLUMN raw_code_hex VARCHAR(40) NULL;
ALTER TABLE DiagnosticDTC ADD COLUMN IF NOT EXISTS source ENUM('local','remote','unknown') NOT NULL DEFAULT 'unknown';

-- ---- Verificación rápida — corré esto después y pegame el resultado ----
-- DESCRIBE Workshops;
-- DESCRIBE ScanVehicles;
-- DESCRIBE DiagnosticDTC;
