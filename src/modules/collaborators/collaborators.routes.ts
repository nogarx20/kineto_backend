
import { Router } from 'express';
import { CollaboratorController } from './collaborators.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new CollaboratorController();

router.use(authMiddleware, tenantMiddleware);

// Collaborators
router.get('/', rbacMiddleware('collaborators.read'), controller.list);
router.post('/', rbacMiddleware('collaborators.create'), controller.create);

// Auxiliares (Sin RBAC estricto específico para el ejemplo, pero heredan auth)
router.get('/positions', controller.listPositions);
router.post('/positions', controller.createPosition);

router.get('/cost-centers', controller.listCostCenters);
router.post('/cost-centers', controller.createCostCenter);

export default router;
