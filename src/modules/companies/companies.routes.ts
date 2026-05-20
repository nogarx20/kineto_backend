import { Router } from 'express';
import { CompanyController } from './companies.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new CompanyController();

// Rutas protegidas para administración global
router.get('/', authMiddleware, rbacMiddleware('settings.manage'), controller.list);
router.post('/', authMiddleware, rbacMiddleware('settings.manage'), controller.create);
router.patch('/:id', authMiddleware, rbacMiddleware('settings.manage'), controller.update);
router.delete('/:id', authMiddleware, rbacMiddleware('settings.manage'), controller.delete);

// Rutas de contexto de usuario
router.get('/me', authMiddleware, controller.getMe);
router.patch('/me/settings', authMiddleware, rbacMiddleware('settings.manage'), controller.updateSettings);

export default router;