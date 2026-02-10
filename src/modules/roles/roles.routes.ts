
import { Router } from 'express';
import { RoleController } from './roles.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new RoleController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', rbacMiddleware('roles.read'), controller.list);
router.post('/', rbacMiddleware('roles.create'), controller.create);
router.patch('/:id', rbacMiddleware('roles.update'), controller.update);
router.delete('/:id', rbacMiddleware('roles.update'), controller.delete);

// Gestión de matriz de permisos del rol
router.get('/:id/permissions', rbacMiddleware('roles.update'), controller.getRolePermissions);
router.patch('/:id/permissions', rbacMiddleware('roles.update'), controller.updateRolePermissions);

export default router;
