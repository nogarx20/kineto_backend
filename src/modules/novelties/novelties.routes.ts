
import { Router } from 'express';
import { NoveltyController } from './novelties.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new NoveltyController();

router.use(authMiddleware, tenantMiddleware);

// Types
router.get('/types', rbacMiddleware('novelties.manage'), controller.listTypes);
router.post('/types', rbacMiddleware('novelties.manage'), controller.createType);
router.patch('/types/:id', rbacMiddleware('novelties.manage'), controller.updateType);
router.delete('/types/:id', rbacMiddleware('novelties.manage'), controller.deleteType);

// Novelties
router.get('/', rbacMiddleware('novelties.manage'), controller.list);
router.post('/', rbacMiddleware('novelties.manage'), controller.create);
router.patch('/:id', rbacMiddleware('novelties.manage'), controller.update);
router.patch('/:id/status', rbacMiddleware('novelties.manage'), controller.updateStatus);
router.delete('/:id', rbacMiddleware('novelties.manage'), controller.delete);

export default router;
