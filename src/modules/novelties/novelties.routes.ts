import { Router } from 'express';
import { NoveltyController } from './novelties.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new NoveltyController();

router.use(authMiddleware, tenantMiddleware);

// Solicitudes
router.get('/', rbacMiddleware('novelties.requests.view'), controller.list);
router.post('/', rbacMiddleware('novelties.requests.manage'), controller.create);
router.put('/:id', rbacMiddleware('novelties.requests.manage'), controller.update);
router.delete('/:id', rbacMiddleware('novelties.requests.manage'), controller.delete);
router.patch('/:id/status', rbacMiddleware('novelties.requests.manage'), controller.updateStatus);

// Tipos de Novedad
router.get('/types', rbacMiddleware('novelties.types.view'), controller.listTypes);
router.post('/types', rbacMiddleware('novelties.types.manage'), controller.createType);
router.put('/types/:id', rbacMiddleware('novelties.types.manage'), controller.updateType);
router.delete('/types/:id', rbacMiddleware('novelties.types.manage'), controller.deleteType);

export default router;
