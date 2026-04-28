import { Router } from 'express';
import { BiometricController } from './biometrics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new BiometricController();

router.use(authMiddleware, tenantMiddleware);

router.post('/enroll', rbacMiddleware('collaborators.personal.update'), controller.enroll);
router.post('/verify-and-mark', rbacMiddleware('attendance.create'), controller.verifyAndMark);
router.post('/identify-and-mark', rbacMiddleware('attendance.create'), controller.identifyAndMark);
router.delete('/:collaboratorId', rbacMiddleware('collaborators.personal.update'), controller.delete);

// Huellas Dactilares
router.get('/:collaboratorId/fingers', rbacMiddleware('collaborators.personal.view'), controller.getFingers);
router.post('/fingers', rbacMiddleware('collaborators.personal.create'), controller.enrollFinger);
router.delete('/fingers/:id', rbacMiddleware('collaborators.personal.delete'), controller.deleteFinger);

export default router;
