
import { Router } from 'express';
import { ShiftController } from './shifts.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ShiftController();

router.use(authMiddleware, tenantMiddleware);

router.get('/zones', rbacMiddleware('shifts.manage'), controller.listZones);
router.post('/zones', rbacMiddleware('shifts.manage'), controller.createZone);
router.patch('/zones/:id', rbacMiddleware('shifts.manage'), controller.updateZone);
router.delete('/zones/:id', rbacMiddleware('shifts.manage'), controller.deleteZone);

router.get('/', rbacMiddleware('shifts.manage'), controller.listShifts);
router.post('/', rbacMiddleware('shifts.manage'), controller.createShift);
router.patch('/:id', rbacMiddleware('shifts.manage'), controller.updateShift);
router.delete('/:id', rbacMiddleware('shifts.manage'), controller.deleteShift);

export default router;
