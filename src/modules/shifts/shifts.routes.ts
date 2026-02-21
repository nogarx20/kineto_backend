import { Router } from 'express';
import { ShiftController } from './shifts.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new ShiftController();

router.use(authMiddleware, tenantMiddleware);

// Gestión de Turnos
router.get('/', rbacMiddleware('shifts.list.view'), controller.list);
router.post('/', rbacMiddleware('shifts.list.manage'), controller.create);
router.put('/:id', rbacMiddleware('shifts.list.manage'), controller.update);
router.delete('/:id', rbacMiddleware('shifts.list.manage'), controller.delete);

// Zonas de Marcaje
router.get('/zones', rbacMiddleware('shifts.zones.view'), controller.listZones);
router.post('/zones', rbacMiddleware('shifts.zones.manage'), controller.createZone);
router.put('/zones/:id', rbacMiddleware('shifts.zones.manage'), controller.updateZone);
router.delete('/zones/:id', rbacMiddleware('shifts.zones.manage'), controller.deleteZone);

export default router;
