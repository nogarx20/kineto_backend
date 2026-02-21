import { Router } from 'express';
import { UserController } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new UserController();

router.post('/login', controller.login);
router.post('/logout', authMiddleware, controller.logout);
router.post('/forgot-password', controller.forgotPassword);

// Rutas protegidas
router.use(authMiddleware, tenantMiddleware);

router.get('/', rbacMiddleware('users.view'), controller.list);
router.post('/', rbacMiddleware('users.manage'), controller.create);
router.get('/summary', rbacMiddleware('users.view'), controller.getSummary);
router.patch('/:id', rbacMiddleware('users.manage'), controller.update);
router.delete('/:id', rbacMiddleware('users.manage'), controller.delete);

// Permisos y Logs
router.get('/:id/effective-permissions', controller.getEffectivePermissions); // Para login/frontend
router.get('/:id/permissions', rbacMiddleware('users.manage'), controller.getPermissions);
router.patch('/:id/permissions', rbacMiddleware('users.manage'), controller.updatePermissions);
router.get('/:id/logs', rbacMiddleware('users.manage'), controller.getLogs);
router.post('/:id/unlock', rbacMiddleware('users.manage'), controller.unlock);

export default router;
