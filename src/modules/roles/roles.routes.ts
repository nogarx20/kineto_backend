
import { Router } from 'express';
import { RoleController } from './roles.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new RoleController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', 
  rbacMiddleware('roles.read'), // Asumiendo que existe este permiso
  controller.list
);

router.post('/', 
  rbacMiddleware('roles.create'), 
  controller.create
);

router.post('/assign', 
  rbacMiddleware('users.update'), 
  controller.assign
);

export default router;
