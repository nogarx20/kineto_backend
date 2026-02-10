
import { Router } from 'express';
import { NoveltyController } from './novelties.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';

const router = Router();
const controller = new NoveltyController();

router.use(authMiddleware, tenantMiddleware);

router.get('/', controller.list);
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.delete('/:id', controller.delete);

export default router;
