
import { Router } from 'express';
import { AttendanceController } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new AttendanceController();

router.use(authMiddleware, tenantMiddleware);

// Endpoint para realizar marcaje
router.post('/mark', rbacMiddleware('attendance.create'), controller.mark);

export default router;
