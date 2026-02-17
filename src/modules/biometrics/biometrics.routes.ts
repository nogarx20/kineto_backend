
import { Router } from 'express';
import { BiometricController } from './biometrics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new BiometricController();

router.use(authMiddleware, tenantMiddleware);

// FaceID
router.post('/enroll', rbacMiddleware('collaborators.create'), controller.enroll);
router.post('/verify-and-mark', rbacMiddleware('attendance.create'), controller.verifyAndMark);
router.post('/identify-and-mark', rbacMiddleware('attendance.create'), controller.identifyAndMark);
router.delete('/:collaboratorId', rbacMiddleware('collaborators.create'), controller.delete);

// Huellas Dactilares
router.post('/fingerprint/enroll', rbacMiddleware('collaborators.create'), controller.enrollFinger);
router.get('/fingerprint/:collaboratorId', rbacMiddleware('collaborators.read'), controller.getFingers);
router.delete('/fingerprint/:id', rbacMiddleware('collaborators.create'), controller.deleteFinger);

export default router;
