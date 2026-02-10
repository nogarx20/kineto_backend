
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
router.patch('/:id', rbacMiddleware('collaborators.create'), controller.update); 
router.delete('/:id', rbacMiddleware('collaborators.create'), controller.delete);

// Auxiliares - Protegidos por el mismo permiso de gestión de colaboradores
router.get('/positions', rbacMiddleware('collaborators.read'), controller.listPositions);
router.post('/positions', rbacMiddleware('collaborators.create'), controller.createPosition);
router.patch('/positions/:id', rbacMiddleware('collaborators.create'), controller.updatePosition);
router.delete('/positions/:id', rbacMiddleware('collaborators.create'), controller.deletePosition);

router.get('/cost-centers', rbacMiddleware('collaborators.read'), controller.listCostCenters);
router.post('/cost-centers', rbacMiddleware('collaborators.create'), controller.createCostCenter);

export default router;
