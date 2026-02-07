
import { Router } from 'express';
import { ShiftController } from './shifts.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ShiftController();

router.use(authMiddleware, tenantMiddleware);

// Utiliza el permiso 'shifts.manage' definido en el seed data
router.get('/zones', rbacMiddleware('shifts.manage'), controller.listZones);
router.post('/zones', rbacMiddleware('shifts.manage'), controller.createZone);

router.get('/', rbacMiddleware('shifts.manage'), controller.listShifts);
router.post('/', rbacMiddleware('shifts.manage'), controller.createShift);

export default router;
