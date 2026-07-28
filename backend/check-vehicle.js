// ============================================================
// Diagnóstico de solo lectura — NO modifica nada.
//
//   cd backend
//   node check-vehicle.js AB841QH
//
// Confirma, directo contra la base (sin pasar por el frontend ni por
// ninguna sesión de navegador), si el auto con esa patente sigue
// existiendo, a qué taller pertenece, y qué sesiones/DTCs tiene. Así
// separamos: "el dato se perdió de verdad" vs. "el dato está ahí pero
// la sesión del navegador no lo puede ver" (que es lo que pasó la vez
// pasada con la patente de prueba).
// ============================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

const patente = (process.argv[2] || '').trim().toUpperCase();

async function main() {
  if (!process.env.DB_URL) {
    console.error('❌ No encontré DB_URL — corré esto desde la carpeta backend/ (donde está tu .env)');
    process.exit(1);
  }
  if (!patente) {
    console.error('❌ Uso: node check-vehicle.js AB841QH');
    process.exit(1);
  }

  const connection = await mysql.createConnection({ uri: process.env.DB_URL });

  console.log(`\n--- Buscando ScanVehicles con patente = "${patente}" ---`);
  const [vehicles] = await connection.query(
    `SELECT sv.id, sv.plate_text, sv.brand, sv.model, sv.workshop_id, w.name as workshop_name, sv.created_at
     FROM ScanVehicles sv LEFT JOIN Workshops w ON sv.workshop_id = w.id
     WHERE sv.plate_text = ?`,
    [patente]
  );

  if (vehicles.length === 0) {
    console.log('❌ No hay NINGÚN ScanVehicle con esa patente en toda la base — si esto es así, se perdió de verdad o nunca se guardó (revisar la respuesta del alta en su momento).');
    await connection.end();
    return;
  }

  console.table(vehicles);

  for (const v of vehicles) {
    console.log(`\n--- Sesiones del vehículo id=${v.id} ---`);
    const [sessions] = await connection.query(
      `SELECT id, scanner_device_id, mode, started_at, ended_at, status FROM DiagnosticSessions WHERE scan_vehicle_id = ? ORDER BY started_at DESC`,
      [v.id]
    );
    if (sessions.length === 0) {
      console.log('   (sin sesiones registradas)');
    } else {
      console.table(sessions);
      const sessionIds = sessions.map(s => s.id);
      const [dtcs] = await connection.query(
        `SELECT id, session_id, decoded_code, description_guess, clear_status, detected_at FROM DiagnosticDTC WHERE session_id IN (?) ORDER BY detected_at DESC`,
        [sessionIds]
      );
      console.log(`--- DTCs de esas sesiones (${dtcs.length}) ---`);
      console.table(dtcs);
    }
  }

  console.log('\n--- Conclusión ---');
  console.log(`El auto SÍ existe (id=${vehicles[0].id}), pertenece al taller "${vehicles[0].workshop_name}" (workshop_id=${vehicles[0].workshop_id}).`);
  console.log('Si en la app no lo ves, el problema es que la cuenta logueada en el navegador ahora mismo no es la dueña de ese taller — mismo chequeo que hicimos con check-taller-owner.js.');

  await connection.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
