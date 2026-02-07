
import { Router } from 'express';
import { CompanyController } from './companies.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new CompanyController();

// Ruta pública para registro
router.post('/', controller.create);

// Rutas protegidas
router.get('/', authMiddleware, controller.list);
router.get('/me', authMiddleware, controller.getMe);
router.patch('/me/settings', authMiddleware, rbacMiddleware('settings.manage'), controller.updateSettings);

export default router;
