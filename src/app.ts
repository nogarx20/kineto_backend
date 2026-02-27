import express from 'express';
import cors from 'cors';
import userRoutes from './modules/users/users.routes';
import companyRoutes from './modules/companies/companies.routes';
import roleRoutes from './modules/roles/roles.routes';
import collaboratorRoutes from './modules/collaborators/collaborators.routes';
import shiftRoutes from './modules/shifts/shifts.routes';
import schedulingRoutes from './modules/scheduling/scheduling.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import reportsRoutes from './modules/reports/reports.routes';
import noveltyRoutes from './modules/novelties/novelties.routes';
import fileRoutes from './modules/files/files.routes';
import biometricRoutes from './modules/biometrics/biometrics.routes';
import holidaysRoutes from './modules/holidays/holidays.routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }) as any);

// Montaje de rutas base para la API v1
const routerV1 = express.Router();

routerV1.use('/users', userRoutes);
routerV1.use('/companies', companyRoutes);
routerV1.use('/roles', roleRoutes);
routerV1.use('/collaborators', collaboratorRoutes);
routerV1.use('/shifts', shiftRoutes);
routerV1.use('/scheduling', schedulingRoutes);
routerV1.use('/attendance', attendanceRoutes);
routerV1.use('/reports', reportsRoutes);
routerV1.use('/novelties', noveltyRoutes);
routerV1.use('/files', fileRoutes);
routerV1.use('/biometrics', biometricRoutes);
routerV1.use('/holidays', holidaysRoutes);

app.use('/api/v1', routerV1);

// Health check
app.get('/health', (req, res) => (res as any).json({ status: 'ok', timestamp: new Date() }));

// Captura de rutas no encontradas (404)
app.use((req, res) => {
  (res as any).status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method
  });
});

// Manejador global de errores (500)
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
