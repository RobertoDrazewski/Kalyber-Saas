// ============================================================
// Diagnóstico de solo lectura — NO modifica nada.
//
//   cd backend
//   node check-taller-owner.js
//
// Te muestra:
//   1. Todos los usuarios con role='taller' (los logins de mecánico)
//   2. Todos los talleres (Workshops) y a qué owner_user_id apuntan
//   3. Si hay algún desalineamiento (un taller sin usuario válido, o
//      un usuario 'taller' sin ningún Workshop que lo tenga como dueño)
//
// Objetivo: confirmar CON QUÉ EMAIL hay que loguearse en la app para
// operar como el taller "Prueba Marcelo" (o el que sea), sin tener
// que adivinar ni tocar la base a ciegas.
// ============================================================
require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  if (!process.env.DB_URL) {
    console.error('❌ No encontré DB_URL — corré esto desde la carpeta backend/ (donde está tu .env)');
    process.exit(1);
  }

  const connection = await mysql.createConnection({ uri: process.env.DB_URL });

  console.log('\n--- Usuarios con role = "taller" ---');
  const [tallerUsers] = await connection.query(
    `SELECT id, name, email, role FROM Users WHERE role = 'taller'`
  );
  if (tallerUsers.length === 0) {
    console.log('⚠️  No hay NINGÚN usuario con role=\'taller\' — por eso no hay con qué loguearse como mecánico.');
  } else {
    console.table(tallerUsers);
  }

  console.log('\n--- Talleres (Workshops) y su dueño ---');
  const [workshops] = await connection.query(
    `SELECT w.id, w.name, w.owner_user_id, u.email as owner_email, u.role as owner_role
     FROM Workshops w LEFT JOIN Users u ON w.owner_user_id = u.id`
  );
  console.table(workshops);

  console.log('\n--- Diagnóstico ---');
  let problemas = 0;
  for (const w of workshops) {
    if (!w.owner_email) {
      console.log(`❌ Taller "${w.name}" (id ${w.id}) tiene owner_user_id=${w.owner_user_id}, que NO existe en Users.`);
      problemas++;
    } else if (w.owner_role !== 'taller') {
      console.log(`⚠️  Taller "${w.name}" (id ${w.id}) es propiedad de ${w.owner_email}, pero ese usuario tiene role='${w.owner_role}' (no 'taller'). Puede ser un desalineamiento viejo.`);
      problemas++;
    } else {
      console.log(`✅ Taller "${w.name}" → login correcto: ${w.owner_email}`);
    }
  }
  for (const u of tallerUsers) {
    const tieneWorkshop = workshops.some(w => w.owner_user_id === u.id);
    if (!tieneWorkshop) {
      console.log(`⚠️  El usuario ${u.email} (role='taller') no es dueño de ningún Workshop — si intenta cargar un auto, va a dar el mismo error 400 que tuviste.`);
      problemas++;
    }
  }

  console.log(problemas === 0 ? '\n🎉 Todo alineado.' : `\n${problemas} cosa(s) para revisar arriba.`);

  await connection.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
