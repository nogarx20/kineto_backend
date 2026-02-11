
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

const app = express();

app.use(cors());
app.use(express.json() as any);

// Routes
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/companies', companyRoutes);
app.use('/api/v1/roles', roleRoutes);
app.use('/api/v1/collaborators', collaboratorRoutes);
app.use('/api/v1/shifts', shiftRoutes);
app.use('/api/v1/scheduling', schedulingRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/novelties', noveltyRoutes);
app.use('/api/v1/files', fileRoutes); // Registro de módulo de archivos

// Health check
app.get('/health', (req, res) => (res as any).json({ status: 'ok', timestamp: new Date() }));

// Error handler para rutas no encontradas
app.use((req, res) => {
  (res as any).status(404).json({ 
    error: 'Ruta no encontrada',
    path: req.originalUrl 
  });
});

// Error handler global
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

export default app;
