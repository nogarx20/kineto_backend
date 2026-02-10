
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

// Contracts (Nomina)
router.get('/contracts', rbacMiddleware('collaborators.read'), controller.listContracts);
router.post('/contracts', rbacMiddleware('collaborators.create'), controller.createContract);
router.patch('/contracts/:id', rbacMiddleware('collaborators.create'), controller.updateContract);
router.delete('/contracts/:id', rbacMiddleware('collaborators.create'), controller.deleteContract);

// Auxiliares
router.get('/positions', rbacMiddleware('collaborators.read'), controller.listPositions);
router.post('/positions', rbacMiddleware('collaborators.create'), controller.createPosition);
router.patch('/positions/:id', rbacMiddleware('collaborators.create'), controller.updatePosition);
router.delete('/positions/:id', rbacMiddleware('collaborators.create'), controller.deletePosition);

router.get('/cost-centers', rbacMiddleware('collaborators.read'), controller.listCostCenters);
router.post('/cost-centers', rbacMiddleware('collaborators.create'), controller.createCostCenter);
router.patch('/cost-centers/:id', rbacMiddleware('collaborators.create'), controller.updateCostCenter);
router.delete('/cost-centers/:id', rbacMiddleware('collaborators.create'), controller.deleteCostCenter);

export default router;
