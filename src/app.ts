
import express from 'express';
import cors from 'cors';
import userRoutes from './modules/users/users.routes';

const app = express();

app.use(cors());
app.use(express.json());

// ✅ RUTA RAÍZ
app.get("/", (_req, res) => {
  res.send("Backend Kineto OK");
});

// Routes
app.use('/api/v1/users', userRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

export default app;
