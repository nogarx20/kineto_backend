
import { Router } from 'express';
import { NoveltyController } from './novelties.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new NoveltyController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', rbacMiddleware('novelties.manage'), controller.list);
router.post('/', rbacMiddleware('novelties.manage'), controller.create);
router.patch('/:id/status', rbacMiddleware('novelties.manage'), controller.updateStatus);
router.delete('/:id', rbacMiddleware('novelties.manage'), controller.delete);

export default router;
