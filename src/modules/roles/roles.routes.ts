import { Router } from 'express';
import { RoleController } from './roles.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new RoleController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', rbacMiddleware('roles.view'), controller.list);
router.post('/', rbacMiddleware('roles.manage'), controller.create);
router.patch('/:id', rbacMiddleware('roles.manage'), controller.update);
router.delete('/:id', rbacMiddleware('roles.manage'), controller.delete);

// Gestión de matriz de permisos del rol
router.get('/:id/permissions', rbacMiddleware('roles.view'), controller.getRolePermissions);
router.patch('/:id/permissions', rbacMiddleware('roles.manage'), controller.updateRolePermissions);

// Gestión de usuarios por rol
router.get('/:id/users', rbacMiddleware('roles.view'), controller.getRoleUsers);
router.patch('/:id/users', rbacMiddleware('roles.manage'), controller.updateRoleUsers);

export default router;
