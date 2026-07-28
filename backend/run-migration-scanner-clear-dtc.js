// ============================================================
// Script de migración manual — corré esto UNA VEZ desde tu terminal:
//
//   cd backend
//   node run-migration-scanner-clear-dtc.js
//
// Mismo criterio que run-migration-scanner.js: usa el DB_URL que ya
// tenés en backend/.env, no instala nada nuevo (mysql2 ya está en tus
// node_modules), y corre cada sentencia POR SEPARADO — si una columna
// ya existe de una corrida anterior, lo dice y sigue, no rompe nada.
//
// Qué agrega: las columnas que necesita el flujo de borrado de fallas
// (Mode $04) en DiagnosticDTC — protocol, clear_status, clear_detail,
// clear_requested_at, cleared_at — más el índice para que el polling
// del equipo (GET /internal/clear-requests, cada 5s) sea rápido.
// Ver migration-scanner-clear-dtc.sql para la versión SQL pura.
// ============================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

const STATEMENTS = [
  ["Agregar DiagnosticDTC.protocol", `ALTER TABLE DiagnosticDTC ADD COLUMN protocol ENUM('OBD-II','J1939','J1708') NULL`],
  ["Agregar DiagnosticDTC.clear_status", `ALTER TABLE DiagnosticDTC ADD COLUMN clear_status ENUM('none','pending','success','failed') NOT NULL DEFAULT 'none'`],
  ["Agregar DiagnosticDTC.clear_detail", `ALTER TABLE DiagnosticDTC ADD COLUMN clear_detail VARCHAR(255) NULL`],
  ["Agregar DiagnosticDTC.clear_requested_at", `ALTER TABLE DiagnosticDTC ADD COLUMN clear_requested_at TIMESTAMP NULL`],
  ["Agregar DiagnosticDTC.cleared_at", `ALTER TABLE DiagnosticDTC ADD COLUMN cleared_at TIMESTAMP NULL`],

  // Índice para el polling del equipo: "¿hay algo pendiente para MI
  // scanner_device_id?" — corre cada 5s por cada equipo conectado.
  ["Crear índice idx_diagdtc_clear_status", `CREATE INDEX idx_diagdtc_clear_status ON DiagnosticDTC (clear_status, clear_requested_at)`],

  // Dato, no estructura — no rompe nada si se corre de nuevo. Todo lo
  // que ya está cargado hasta hoy es OBD-II porque, hasta esta fecha,
  // es el único protocolo que sube DTCs al backend (J1939/J1708 son
  // sniffer-only en el firmware todavía).
  ["Completar protocol='OBD-II' en DTCs existentes", `UPDATE DiagnosticDTC SET protocol = 'OBD-II' WHERE protocol IS NULL`],
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
            const [result] = await connection.query(sql);
            if (label.startsWith('Completar')) {
                console.log(`✅ ${label} — ${result.affectedRows} fila(s) actualizada(s)`);
            } else {
                console.log(`✅ ${label}`);
            }
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

    console.log('\n--- Estructura final de DiagnosticDTC ---');
    const [cols] = await connection.query('DESCRIBE DiagnosticDTC');
    console.table(cols.map(c => ({ campo: c.Field, tipo: c.Type, nulo: c.Null, default: c.Default })));

    console.log('\n--- Cuántos DTC quedaron con cada protocolo ---');
    const [porProtocolo] = await connection.query(
        `SELECT protocol, COUNT(*) as cantidad FROM DiagnosticDTC GROUP BY protocol`
    );
    console.table(porProtocolo);

    await connection.end();
    console.log('\n🎉 Listo.');
}

main().catch(err => {
    console.error('❌ Error fatal:', err.message);
    process.exit(1);
});