import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ReportsController();

router.use(authMiddleware, tenantMiddleware);

router.get('/dashboard', rbacMiddleware('dashboard.view'), controller.getStats);
router.get('/audit', rbacMiddleware('security.view'), controller.getAuditLogs); // Logs de auditoría suelen ser de seguridad

export default router;
