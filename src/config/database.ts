
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'app.sittca.com.co',
  user: process.env.DB_USER || 'kineto',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'asistenza_pro_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
