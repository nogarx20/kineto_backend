import { Router } from 'express';
import { AttendanceController } from './attendance.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new AttendanceController();

router.use(authMiddleware, tenantMiddleware);

router.post('/mark', rbacMiddleware('attendance.mark'), controller.mark);
router.get('/schedule/:scheduleId/records', rbacMiddleware('attendance.view'), controller.getRecordsBySchedule);

export default router;
