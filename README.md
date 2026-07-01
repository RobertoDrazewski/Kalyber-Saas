🚀 Kyber — SaaS de Gestión de Flota
Kyber es una plataforma integral para la gestión y monitoreo de flotas de vehículos. Permite el seguimiento en tiempo real, análisis heurístico de mantenimiento preventivo, y está preparado para operar tanto con simulaciones de prueba como con hardware telemático real (GPS/OBD2).

✨ Características Principales
🧠 Motor Heurístico Inteligente (mlService): Analiza el desgaste de neumáticos y frenos basado en kilometraje y eventos de frenada brusca. Detecta anomalías mediante z-score comparando el comportamiento del auto contra su propio historial.

🗺️ Mapa Interactivo Mejorado: Visualización de la flota con miniaturas de los vehículos (reemplazando íconos genéricos), panel lateral filtrable por patente y gráficos en tiempo real de velocidad y RPM.

📅 Calendario de Actividad: Registro diario de horas de uso y viajes, reconstruido automáticamente a partir de la telemetría y los trayectos guardados.

🚗 Simulador de Flota Integrado: Genera 6 autos virtuales circulando por Mendoza con telemetría realista. Pasan por el mismo motor de machine learning que los autos reales. Se controla mediante la variable SIMULATOR_ENABLED.

📡 Preparado para Hardware Real: Scaffold completo para ingesta de datos (telemetryIngestReal.js) listo para integrar equipos GPS Teltonika u otros, conviviendo en paralelo con los vehículos simulados.

📸 Gestión Visual: Subida de fotos reales de los vehículos directamente desde el dashboard (almacenamiento en Base64 en la base de datos).

📱 Notificaciones limpias: Servicio de WhatsApp preparado y estructurado correctamente en el backend.

🛠️ Cómo correr el proyecto localmente
1. 🗄️ Base de Datos
El proyecto requiere inicializar las tablas (Devices, Telemetry_Raw, Vehicles, Trips). Ejecutá el schema una sola vez contra tu base de datos MySQL:

Bash
mysql -h reseau.proxy.rlwy.net -P 49736 -u root -p railway < backend/src/db/schema.sql
(Se te solicitará la contraseña, la cual debe estar en tu archivo .env). Alternativamente, podés pegar el contenido de schema.sql directamente en el editor SQL de tu proveedor.

⚠️ Nota de Seguridad: Nunca commitees tu archivo .env con contraseñas reales. Utilizá un archivo .env.example como plantilla en el repositorio y rotá las contraseñas si alguna vez quedaron expuestas.

2. ⚙️ Backend
El backend se encarga de la API, el simulador y la ingesta de telemetría.

Bash
cd backend
npm install
npm run dev
Nota: Por defecto, el simulador arranca automáticamente si SIMULATOR_ENABLED=true en tu archivo .env y dará de alta 6 autos demo en su primera ejecución.

3. 💻 Frontend
El frontend consume la API y renderiza el dashboard interactivo.

Bash
cd frontend
npm install
npm run dev
☁️ Deploy en Railway
El proyecto está diseñado para desplegarse fácilmente creando dos servicios que apunten a este mismo repositorio:

Servicio 1: Backend
Root Directory: backend/

Start Command: npm start

Variables de Entorno necesarias: DB_URL, JWT_SECRET, SIMULATOR_ENABLED

Servicio 2: Frontend
Root Directory: frontend/

Build Command: npm run build

Hosting: Se sirve como sitio estático (dist/).

Configuración previa: Antes de buildear, asegurate de ajustar API_URL en src/services/api.js para que apunte a la URL pública de tu backend en Railway (por defecto apunta a localhost:3001).

📡 Integración de Equipo Real (Teltonika)
Cuando tengas el hardware GPS en mano, seguí estos pasos para integrarlo:

Alta del equipo: Registrá el dispositivo por su IMEI enviando un POST /api/devices con el payload { imei, label }.

Vinculación: Pareá el dispositivo a un vehículo real desde la pestaña Flota en el dashboard (o mediante POST /api/devices/pair).

Configuración del Parser: Completá el parser Codec8 en backend/src/services/telemetryIngestReal.js (las instrucciones detalladas están dentro de ese mismo archivo).

Monitoreo: A partir de ese momento, el auto real aparecerá en el dashboard con el atributo source: 'real', conviviendo sin problemas con la flota de simulación.

📝 Próximos Pasos Sugeridos (To-Do)
[ ] Seguridad: Hashear las contraseñas (password_hash) utilizando bcrypt (actualmente se comparan en texto plano por retrocompatibilidad).

[ ] Almacenamiento de Archivos: Migrar las fotos de los vehículos de Base64-en-DB a un servicio de storage real (como AWS S3 o Cloudinary) para escalar mejor cuando la flota crezca.

[ ] Ajuste de Tarifas: Reemplazar la tarifa estimada actual del simulador (fórmula: 350 + km * 180) por valores calibrados con datos reales del mercado de Mendoza (Uber/Taxis) para mejorar la precisión del comparador de rentabilidad.