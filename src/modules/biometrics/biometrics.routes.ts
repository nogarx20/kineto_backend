
import { Router } from 'express';
import { BiometricController } from './biometrics.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { rbacMiddleware } from '../../middlewares/rbac.middleware';

const router = Router();
const controller = new BiometricController();

router.use(authMiddleware, tenantMiddleware);

// Enrolamiento (Requiere permisos de gestión de colaboradores)
router.post('/enroll', rbacMiddleware('collaborators.create'), controller.enroll);

// Verificación y Marcaje (Permitido para usuarios con permiso de asistencia)
router.post('/verify-and-mark', rbacMiddleware('attendance.create'), controller.verifyAndMark);

// Eliminar biometría
router.delete('/:collaboratorId', rbacMiddleware('collaborators.create'), controller.delete);

export default router;
