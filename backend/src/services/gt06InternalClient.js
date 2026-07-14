// ============================================================
// Cliente para pedirle al proceso REAL del servidor TCP
// (gt06-standalone.js, servicio de Railway separado) que le mande un
// comando a un equipo. El proceso de la API (este) NO tiene acceso al
// Map de sockets activos — vive en el otro proceso — así que en vez
// de llamar gt06Server.sendCommandToDevice() directo (que en este
// proceso daría una copia del módulo con activeSockets vacío, ver
// nota larga en gt06Server.js), le pegamos por HTTP interno.
//
// Requiere configurar en las env vars de este servicio (Kalyber-Saas):
//   GT06_INTERNAL_URL=http://<servicio-gt06-standalone>.railway.internal:9001
//   GT06_INTERNAL_SECRET=<mismo valor que en el servicio gt06-standalone>
// ============================================================

const INTERNAL_URL = process.env.GT06_INTERNAL_URL;
const INTERNAL_SECRET = process.env.GT06_INTERNAL_SECRET || '';

async function sendCommandToDevice(imei, command) {
    if (!INTERNAL_URL) {
        return {
            sent: false,
            reason: 'Falta configurar GT06_INTERNAL_URL en las variables de entorno de este servicio (la URL privada de Railway del servicio gt06-standalone). Sin esto, no hay forma de que la API le pida al servidor TCP real que mande el comando.',
        };
    }
    try {
        const res = await fetch(`${INTERNAL_URL}/internal/send-command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}),
            },
            body: JSON.stringify({ imei, command }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { sent: false, reason: data.error || `El servicio gt06-standalone respondió ${res.status}` };
        }
        return data; // { sent: true, correlationId } o { sent: false, reason }
    } catch (err) {
        return {
            sent: false,
            reason: `No se pudo contactar al servicio gt06-standalone (${INTERNAL_URL}): ${err.message}. Revisá que GT06_INTERNAL_URL apunte al dominio privado correcto y que ambos servicios estén en el mismo proyecto de Railway.`,
        };
    }
}

async function sendFenceCommand(imei, { fenceId, lat, lng, radiusM, mode }) {
    if (!INTERNAL_URL) {
        return {
            sent: false,
            reason: 'Falta configurar GT06_INTERNAL_URL en las variables de entorno de este servicio.',
        };
    }
    try {
        const res = await fetch(`${INTERNAL_URL}/internal/send-fence`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}),
            },
            body: JSON.stringify({ imei, fenceId, lat, lng, radiusM, mode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { sent: false, reason: data.error || `El servicio gt06-standalone respondió ${res.status}` };
        }
        return data;
    } catch (err) {
        return {
            sent: false,
            reason: `No se pudo contactar al servicio gt06-standalone (${INTERNAL_URL}): ${err.message}`,
        };
    }
}

async function sendParamsCommand(imei, params) {
    if (!INTERNAL_URL) {
        return { sent: false, reason: 'Falta configurar GT06_INTERNAL_URL en las variables de entorno de este servicio.' };
    }
    try {
        const res = await fetch(`${INTERNAL_URL}/internal/send-params`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(INTERNAL_SECRET ? { 'x-internal-secret': INTERNAL_SECRET } : {}),
            },
            body: JSON.stringify({ imei, params }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { sent: false, reason: data.error || `El servicio gt06-standalone respondió ${res.status}` };
        }
        return data;
    } catch (err) {
        return { sent: false, reason: `No se pudo contactar al servicio gt06-standalone (${INTERNAL_URL}): ${err.message}` };
    }
}

module.exports = { sendCommandToDevice, sendFenceCommand, sendParamsCommand };