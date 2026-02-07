
import { Router } from 'express';
import { UserController } from './users.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new UserController();

router.post('/login', controller.login);

router.get('/', 
  authMiddleware, 
  tenantMiddleware, 
  rbacMiddleware('users.read'), 
  controller.list
);

router.post('/', 
  authMiddleware, 
  tenantMiddleware, 
  rbacMiddleware('users.create'), 
  controller.create
);

export default router;
