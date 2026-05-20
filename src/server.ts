
import app from './app';
import pool from './config/database';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test database connection
    const connection = await pool.getConnection();
    console.log('✅ Base de Datos Conectada Correctamente');
    connection.release();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor Asistenza Pro ejecutándose en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Error al iniciar el servidor:', err);
    // Fix: Cast process to any to call exit as the property is reported as missing on the Process type
    (process as any).exit(1);
  }
};

startServer();
