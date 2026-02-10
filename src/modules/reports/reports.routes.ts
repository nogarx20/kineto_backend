
import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ReportsController();

router.use(authMiddleware, tenantMiddleware);

// El dashboard ahora usa dashboard.view para permitir acceso a indicadores básicos
router.get('/stats', rbacMiddleware('dashboard.view'), controller.getStats);

// Los logs de auditoría se mantienen bajo settings.manage por ser información sensible
router.get('/audit-logs', rbacMiddleware('settings.manage'), controller.getAuditLogs);

export default router;
