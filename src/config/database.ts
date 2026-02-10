
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'app.sittca.com.co',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asistenza_pro_db',
  waitForConnections: true,
  connectionLimit: 20,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

/**
 * Fix para error de compilación TS2769 y TS2339:
 * El pool de mysql2/promise requiere un cast para manejar eventos de error globales 
 * que no están mapeados estrictamente en las definiciones de tipos de promesas.
 */
(pool as any).on('error', (err: any) => {
  console.error('[Database Pool Error]:', err);
  if (err && err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('La conexión con la base de datos se perdió. El pool intentará reconectar en la próxima consulta.');
  } else if (err && err.code === 'ECONNREFUSED') {
    console.error('La conexión fue rechazada por el servidor de base de datos.');
  }
});

export default pool;
