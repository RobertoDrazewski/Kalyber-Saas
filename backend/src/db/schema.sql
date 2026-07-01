-- ============================================================
-- Kyber SaaS — Schema completo (MySQL / Railway)
-- Ejecutar una sola vez contra la base nueva:
--   mysql -h reseau.proxy.rlwy.net -P 49736 -u root -p railway < schema.sql
-- o pegarlo en el editor SQL de Railway.
-- ============================================================

CREATE TABLE IF NOT EXISTS Users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin','owner','viewer') NOT NULL DEFAULT 'owner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    phone_number VARCHAR(30),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipos GPS+OBD2 (Teltonika u otro). Existen antes de estar
-- vinculados a un vehículo: se compran, se les da de alta por IMEI,
-- y después se "parean" desde la tab de Flota.
CREATE TABLE IF NOT EXISTS Devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imei VARCHAR(50) NOT NULL UNIQUE,
    label VARCHAR(100),
    status ENUM('unpaired','paired','offline') NOT NULL DEFAULT 'unpaired',
    vehicle_id INT NULL,
    last_seen_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Vehicles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plate VARCHAR(20) NOT NULL UNIQUE,
    brand VARCHAR(60),
    model VARCHAR(60),
    year INT NULL,
    photo_url LONGTEXT NULL,
    status ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
    current_driver_id INT NULL,
    device_id INT NULL,
    source ENUM('real','simulated') NOT NULL DEFAULT 'real',
    lat DECIMAL(10,7) NULL,
    lng DECIMAL(10,7) NULL,
    heading DECIMAL(5,1) NULL,
    odometer_km DECIMAL(10,1) NOT NULL DEFAULT 0,
    last_ping_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_driver FOREIGN KEY (current_driver_id) REFERENCES Drivers(id) ON DELETE SET NULL,
    CONSTRAINT fk_vehicle_device FOREIGN KEY (device_id) REFERENCES Devices(id) ON DELETE SET NULL
);

ALTER TABLE Devices
    ADD CONSTRAINT fk_device_vehicle FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE SET NULL;

-- Lecturas crudas de telemetría (una fila por "ping" del equipo,
-- real o simulado). Es la fuente de verdad para reconstruir viajes
-- y para el calendario de actividad.
CREATE TABLE IF NOT EXISTS Telemetry_Raw (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lat DECIMAL(10,7) NULL,
    lng DECIMAL(10,7) NULL,
    speed_kmh DECIMAL(5,1) NULL,
    engine_rpm INT NULL,
    engine_load DECIMAL(5,1) NULL,
    coolant_temp DECIMAL(5,1) NULL,
    battery_voltage DECIMAL(4,2) NULL,
    harsh_brake TINYINT(1) NOT NULL DEFAULT 0,
    dtc_codes VARCHAR(255) NULL,
    source ENUM('real','simulated') NOT NULL DEFAULT 'real',
    INDEX idx_vehicle_time (vehicle_id, recorded_at),
    CONSTRAINT fk_raw_vehicle FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE CASCADE
);

-- Snapshot calculado por el motor de heurísticas/ML, uno por vehículo
-- por tick relevante (no cada ping crudo, para no saturar).
CREATE TABLE IF NOT EXISTS Telemetry_Heuristics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    engine_rpm INT NULL,
    speed_kmh DECIMAL(5,1) NULL,
    engine_load DECIMAL(5,1) NULL,
    tire_wear_score DECIMAL(5,1) NULL,
    brake_wear_score DECIMAL(5,1) NULL,
    driver_score DECIMAL(5,1) NULL,
    anomaly_flag TINYINT(1) NOT NULL DEFAULT 0,
    anomaly_detail VARCHAR(255) NULL,
    ai_recommendation TEXT NULL,
    source ENUM('real','simulated') NOT NULL DEFAULT 'real',
    INDEX idx_vehicle_time_h (vehicle_id, recorded_at),
    CONSTRAINT fk_heur_vehicle FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE CASCADE
);

-- Viajes reconstruidos a partir de Telemetry_Raw (inicio = primer
-- movimiento tras estar detenido, fin = detención sostenida).
CREATE TABLE IF NOT EXISTS Trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    driver_id INT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    distance_km DECIMAL(6,2) NOT NULL DEFAULT 0,
    duration_minutes INT NULL,
    estimated_earnings DECIMAL(8,2) NOT NULL DEFAULT 0,
    start_lat DECIMAL(10,7) NULL,
    start_lng DECIMAL(10,7) NULL,
    end_lat DECIMAL(10,7) NULL,
    end_lng DECIMAL(10,7) NULL,
    source ENUM('real','simulated') NOT NULL DEFAULT 'real',
    CONSTRAINT fk_trip_vehicle FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE CASCADE,
    CONSTRAINT fk_trip_driver FOREIGN KEY (driver_id) REFERENCES Drivers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS MaintenanceEvents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_id INT NOT NULL,
    type ENUM('neumaticos','frenos','fluidos','bateria','motor','otro') NOT NULL,
    description VARCHAR(255),
    event_date DATE NOT NULL,
    km_at_event DECIMAL(10,1),
    origin ENUM('regla','ml','manual') NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_maint_vehicle FOREIGN KEY (vehicle_id) REFERENCES Vehicles(id) ON DELETE CASCADE
);

-- Usuario admin de arranque (password: kyber2026 → hashear en producción,
-- por ahora el authController compara texto plano como ya tenías).
INSERT INTO Users (name, email, password_hash, role)
SELECT 'Roberto', 'roberto@puma-code.com', 'kyber2026', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE email = 'roberto@puma-code.com');
