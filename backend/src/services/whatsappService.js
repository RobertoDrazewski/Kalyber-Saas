// ============================================================
// Notificaciones por WhatsApp — Arquitectura Multitenant SaaS
// ============================================================
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Almacenamiento en memoria de los clientes de WhatsApp activos.
// La llave será el ID del administrador (owner_id).
const activeClients = new Map();

/**
 * Inicializa y devuelve un código QR para que un admin vincule su teléfono.
 * Esta función debe llamarse desde un nuevo endpoint (ej. GET /api/whatsapp/qr)
 */
async function initializeAdminSession(adminId) {
    if (activeClients.has(adminId)) {
        return { status: 'already_connected', message: 'El dispositivo ya está vinculado.' };
    }

    const client = new Client({
        // LocalAuth guarda la sesión en el disco del servidor para que 
        // el admin no tenga que escanear el QR cada vez que se reinicia Railway.
        authStrategy: new LocalAuth({ clientId: `admin_${adminId}` }),
        puppeteer: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Vital para correr en Railway
        }
    });

    return new Promise((resolve, reject) => {
        client.on('qr', async (qr) => {
            console.log(`[whatsappService] QR generado para Admin ${adminId}`);
            try {
                const qrBase64 = await qrcode.toDataURL(qr);
                resolve({ status: 'qr_ready', qr: qrBase64 });
            } catch (err) {
                reject(err);
            }
        });

        client.on('ready', () => {
            console.log(`[whatsappService] Cliente de WhatsApp listo para Admin ${adminId}`);
            activeClients.set(adminId, client);
            // Si entra por 'ready' directo (por LocalAuth), resolvemos.
            resolve({ status: 'ready' }); 
        });

        client.on('auth_failure', () => {
            console.error(`[whatsappService] Falló la autenticación para Admin ${adminId}`);
            activeClients.delete(adminId);
        });

        client.on('disconnected', () => {
            console.log(`[whatsappService] Admin ${adminId} desconectó su WhatsApp`);
            activeClients.delete(adminId);
            client.destroy();
        });

        client.initialize().catch(reject);
    });
}

/**
 * Envía un mensaje usando la sesión de WhatsApp del administrador correspondiente.
 */
async function sendAlert(adminId, phoneNumber, message) {
    // Verificamos si el admin tiene su teléfono vinculado en el servidor
    const client = activeClients.get(adminId);

    if (!client) {
        console.log(`[whatsappService] Admin ${adminId} no tiene WhatsApp vinculado. Omitiendo mensaje a ${phoneNumber}.`);
        return { sent: false, reason: 'El administrador no ha escaneado el código QR.' };
    }

    try {
        // Limpiamos el número y le agregamos el sufijo que usa la red de WhatsApp
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const chatId = `${cleanPhone}@c.us`;

        await client.sendMessage(chatId, message);
        console.log(`[whatsappService] WhatsApp enviado a ${cleanPhone} desde cuenta del Admin ${adminId}`);
        return { sent: true };
    } catch (error) {
        console.error(`[whatsappService] Error enviando mensaje para Admin ${adminId}:`, error.message);
        return { sent: false, error: error.message };
    }
}

module.exports = { initializeAdminSession, sendAlert };