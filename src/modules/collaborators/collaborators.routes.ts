import { Router } from 'express';
import { CollaboratorController } from './collaborators.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new CollaboratorController();

router.use(authMiddleware, tenantMiddleware);

// Personal
router.get('/', rbacMiddleware('collaborators.personal.view'), controller.list);
router.post('/', rbacMiddleware('collaborators.personal.create'), controller.create);
router.put('/:id', rbacMiddleware('collaborators.personal.update'), controller.update);
router.delete('/:id', rbacMiddleware('collaborators.personal.delete'), controller.delete);

// Contratos
router.get('/contracts', rbacMiddleware('collaborators.contracts.view'), controller.listContracts);
router.post('/contracts', rbacMiddleware('collaborators.contracts.create'), controller.createContract);
router.put('/contracts/:id', rbacMiddleware('collaborators.contracts.update'), controller.updateContract);
router.delete('/contracts/:id', rbacMiddleware('collaborators.contracts.delete'), controller.deleteContract);

// Cargos
router.get('/positions', rbacMiddleware('collaborators.positions.view'), controller.listPositions);
router.post('/positions', rbacMiddleware('collaborators.positions.manage'), controller.createPosition);
router.put('/positions/:id', rbacMiddleware('collaborators.positions.manage'), controller.updatePosition);
router.delete('/positions/:id', rbacMiddleware('collaborators.positions.manage'), controller.deletePosition);

// Centros de Costo
router.get('/cost-centers', rbacMiddleware('collaborators.cost_centers.view'), controller.listCostCenters);
router.post('/cost-centers', rbacMiddleware('collaborators.cost_centers.manage'), controller.createCostCenter);
router.put('/cost-centers/:id', rbacMiddleware('collaborators.cost_centers.manage'), controller.updateCostCenter);
router.delete('/cost-centers/:id', rbacMiddleware('collaborators.cost_centers.manage'), controller.deleteCostCenter);

export default router;
