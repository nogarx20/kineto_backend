
import { Router } from 'express';
import multer from 'multer';
import { FilesController } from './files.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';

const router = Router();
const controller = new FilesController();

// Configuración de multer en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Límite de 2MB
});

router.post('/upload', authMiddleware, tenantMiddleware, upload.single('file'), controller.upload);

export default router;
