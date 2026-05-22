import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ReportsController();

router.use(authMiddleware, tenantMiddleware);

router.get('/stats', rbacMiddleware('dashboard.view'), controller.getStats);
router.get('/audit-logs', rbacMiddleware('security.view'), controller.getAuditLogs);
router.get('/activity-log', rbacMiddleware('reports.view'), controller.getActivityLog);
router.post('/activity-log/validate/:id', rbacMiddleware('reports.view'), controller.validateActivityLogEntry);
router.patch('/activity-log/:id', rbacMiddleware('reports.edit'), controller.updateActivityLogEntry);

export default router;
