-- ============================================================
-- MIGRACIÓN CONSOLIDADA PARA EL LANZAMIENTO (20/07/2026)
--
-- Reúne TODOS los cambios de base de datos que las features nuevas
-- necesitan y que todavía no estaban en migraciones sueltas. Correr
-- UNA sola vez, en orden, antes de lanzar.
--
-- Es idempotente donde se puede (IF NOT EXISTS / IGNORE), así que si
-- alguna parte ya se corrió, no rompe.
-- ============================================================

-- ------------------------------------------------------------
-- 1) HERRAMIENTAS DEL CHOFER
--    driverToolsController.js usa estas dos cosas. Sin ellas, las
--    tarjetas de "Tu jornada", "Chequeo del auto", "Tu manejo" y
--    "Logros" en la vista del chofer fallan.
-- ------------------------------------------------------------

-- Tarifa por km del chofer (para estimar su ganancia por GPS).
-- NULL = usa el default del sistema. Se envuelve en un procedure para
-- que no explote si la columna ya existe (MySQL no tiene ADD COLUMN IF
-- NOT EXISTS en todas las versiones).
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Drivers' AND COLUMN_NAME = 'rate_per_km'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE Drivers ADD COLUMN rate_per_km DECIMAL(8,2) NULL DEFAULT NULL',
  'SELECT "rate_per_km ya existe" AS info'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Logros/rachas desbloqueados por chofer
CREATE TABLE IF NOT EXISTS DriverAchievements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    achievement_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_driver_achievement (driver_id, achievement_key),
    CONSTRAINT fk_achievement_driver FOREIGN KEY (driver_id) REFERENCES Drivers(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- 2) PLAN TALLER EN SUBSCRIPTIONS
--    El carrito ya ofrece el Plan Taller y pricing.js lo cotiza, pero
--    la tabla que registra la suscripción después de pagar tenía el
--    ENUM viejo. Sin esto, comprar el Plan Taller falla al registrar
--    el pago (el cobro se haría, pero el INSERT explotaría).
-- ------------------------------------------------------------
ALTER TABLE Subscriptions MODIFY COLUMN plan ENUM('basico','avanzado','taller') NOT NULL;

-- ------------------------------------------------------------
-- 3) (Defensivo) Asegurar que las columnas de geocerca que usa el
--    cálculo por GPS existan. checkGeofenceCrossings() usa
--    last_known_inside; si por alguna migración vieja no está, la
--    detección de cruces no persiste el estado.
-- ------------------------------------------------------------
SET @gcol := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Geofences' AND COLUMN_NAME = 'last_known_inside'
);
SET @gddl := IF(@gcol = 0,
  'ALTER TABLE Geofences ADD COLUMN last_known_inside TINYINT(1) NULL DEFAULT NULL',
  'SELECT "last_known_inside ya existe" AS info'
);
PREPARE gstmt FROM @gddl; EXECUTE gstmt; DEALLOCATE PREPARE gstmt;
