
import { Router } from 'express';
import { SchedulingController } from './scheduling.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new SchedulingController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', rbacMiddleware('scheduling.manage'), controller.getWeekly);
router.post('/', rbacMiddleware('scheduling.manage'), controller.assign);
router.post('/bulk', rbacMiddleware('scheduling.manage'), controller.bulkAssign);
router.get('/parameters', rbacMiddleware('scheduling.manage'), controller.getSchedulingParameters);
router.post('/parameters', rbacMiddleware('scheduling.manage'), controller.saveSchedulingParameters);
router.post('/bulk-delete', rbacMiddleware('scheduling.manage'), controller.bulkDelete);
router.delete('/:id', rbacMiddleware('scheduling.manage'), controller.delete);

export default router;
