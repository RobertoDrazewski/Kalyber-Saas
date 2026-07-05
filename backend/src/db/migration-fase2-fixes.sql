-- ============================================================
-- Kalyber — Migración "Fase 2 fixes"
--
-- Ejecutar UNA vez contra la base de Railway. Requiere MySQL 8.0.29+
-- (usa "ADD COLUMN IF NOT EXISTS", soportado desde esa versión —
-- Railway por defecto ya usa 8.0.3x así que debería andar. Si tu
-- versión es más vieja, avisame y te la reescribo con procedures).
--
-- Este archivo asume que ya corriste el migration-roles-multitenancy
-- de la sesión anterior (columnas owner_id, role super_admin/admin/
-- driver). Si NO lo corriste, decime y te mando el consolidado desde
-- cero — este acá solo agrega lo que faltaba para: el fix de
-- pairing de equipos, los campos de persona/empresa/DNI/carnet, y
-- las suscripciones de Mercado Pago.
-- ============================================================

-- ---- Users: persona física / empresa, DNI, CUIT, teléfono, carnet ----
ALTER TABLE Users
    ADD COLUMN IF NOT EXISTS entity_type ENUM('persona','empresa') NULL,
    ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS dni VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(150) NULL,
    ADD COLUMN IF NOT EXISTS cuit VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS license_expiry DATE NULL;

-- ---- Drivers: DNI y vencimiento de carnet (antes solo license_number) ----
ALTER TABLE Drivers
    ADD COLUMN IF NOT EXISTS dni VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS license_expiry DATE NULL;

-- ---- Devices: aseguramos que owner_id sea NULLABLE (equipos "en
-- stock" sin reclamar todavía) y que exista la columna model ----
ALTER TABLE Devices
    ADD COLUMN IF NOT EXISTS model VARCHAR(20) NULL DEFAULT 'VL502',
    MODIFY COLUMN owner_id INT NULL;

-- Si algún equipo ya existente quedó con owner_id = el super_admin
-- que lo creó (por el bug viejo) y TODAVÍA no está pareado a ningún
-- vehículo, lo liberamos para que cualquier admin lo pueda reclamar
-- al parear. Los que ya están pareados NO se tocan (ya son de esa
-- flota en la práctica).
UPDATE Devices d
JOIN Users u ON d.owner_id = u.id AND u.role = 'super_admin'
SET d.owner_id = NULL
WHERE d.vehicle_id IS NULL;

-- ---- Suscripciones de Mercado Pago ----
CREATE TABLE IF NOT EXISTS Subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    owner_id INT NULL,                          -- se linkea cuando el admin ya tiene cuenta creada
    plan ENUM('basico','avanzado') NOT NULL,
    vehicle_count INT NOT NULL,
    discount_pct INT NOT NULL DEFAULT 0,
    monthly_total DECIMAL(10,2) NOT NULL,
    billing_name VARCHAR(150) NOT NULL,
    billing_tax_id VARCHAR(20) NULL,
    billing_email VARCHAR(150) NOT NULL,
    billing_phone VARCHAR(30) NULL,
    mp_preapproval_id VARCHAR(100) NULL,
    status ENUM('pending','active','cancelled','rejected') NOT NULL DEFAULT 'pending',
    last_payment_at TIMESTAMP NULL,
    last_payment_amount DECIMAL(10,2) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subscription_owner FOREIGN KEY (owner_id) REFERENCES Users(id) ON DELETE SET NULL
);

-- ---- Los 2 super_admin reales ----
-- OJO: reemplazá 'CAMBIAR_PASSWORD_1' y 'CAMBIAR_PASSWORD_2' por
-- contraseñas reales ANTES de correr esto. Se guardan en texto plano
-- porque así compara el login hoy (ver nota de seguridad en
-- usersController.js) — cambialas apenas entres por primera vez.
INSERT INTO Users (name, email, password_hash, role, first_name, last_name)
SELECT 'Roberto Drazewski', 'drazewski@puma-code.com', 'CAMBIAR_PASSWORD_1', 'super_admin', 'Roberto', 'Drazewski'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE email = 'drazewski@puma-code.com');

INSERT INTO Users (name, email, password_hash, role, first_name, last_name)
SELECT 'Mauro Cannizzo', 'security@puma-code.com', 'CAMBIAR_PASSWORD_2', 'super_admin', 'Mauro', 'Cannizzo'
WHERE NOT EXISTS (SELECT 1 FROM Users WHERE email = 'security@puma-code.com');
