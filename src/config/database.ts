
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'app.sittca.com.co',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asistenza_pro_db',
  waitForConnections: true,
  connectionLimit: 20, // Aumentado para mayor concurrencia
  maxIdle: 10, // Máximo de conexiones inactivas
  idleTimeout: 60000, // Cerrar conexiones inactivas tras 60s
  queueLimit: 0,
  enableKeepAlive: true, // Mantiene la conexión activa para evitar timeouts del servidor
  keepAliveInitialDelay: 10000 // 10s
});

// Listener para errores de conexión en caliente
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Database connection was closed.');
  }
});

export default pool;
