
import { Router } from 'express';
import { BiometricController } from './biometrics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new BiometricController();

router.use(authMiddleware, tenantMiddleware);

router.post('/enroll', rbacMiddleware('collaborators.create'), controller.enroll);
router.post('/verify-and-mark', rbacMiddleware('attendance.create'), controller.verifyAndMark);
router.post('/identify-and-mark', rbacMiddleware('attendance.create'), controller.identifyAndMark);
router.delete('/:collaboratorId', rbacMiddleware('collaborators.create'), controller.delete);

export default router;
