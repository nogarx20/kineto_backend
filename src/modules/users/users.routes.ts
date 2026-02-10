
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

router.get('/', authMiddleware, tenantMiddleware, rbacMiddleware('users.read'), controller.list);
router.post('/', authMiddleware, tenantMiddleware, rbacMiddleware('users.create'), controller.create);
router.patch('/:id', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.update);

router.delete('/:id', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.delete);

// Ruta para el inicio de sesión (Permisos combinados)
router.get('/:id/effective-permissions', authMiddleware, tenantMiddleware, controller.getEffectivePermissions);

// Rutas para gestión administrativa (Solo permisos directos)
router.get('/:id/permissions', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.getPermissions);
router.patch('/:id/permissions', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.updatePermissions);

router.get('/:id/logs', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.getLogs);
router.post('/:id/unlock', authMiddleware, tenantMiddleware, rbacMiddleware('users.update'), controller.unlock);

export default router;
