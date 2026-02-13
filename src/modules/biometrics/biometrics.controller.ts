import { Request, Response } from 'express';
import { BiometricService } from './biometrics.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new BiometricService();

export class BiometricController {
  enroll = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { collaboratorId, descriptor } = (req as any).body;

      const result = await service.enroll(user.company_id, collaboratorId, descriptor);
      
      await logAudit(req, 'FACEID_ENROLL_SUCCESS', 'collaborators', collaboratorId);
      (res as any).json(result);
    } catch (err: any) {
      await logAudit(req, 'FACEID_ENROLL_FAILED', 'collaborators', (req as any).body.collaboratorId, { error: err.message });
      (res as any).status(400).json({ error: err.message });
    }
  };

  // Fix: Add delete method to handle removal of biometric templates
  delete = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { collaboratorId } = (req as any).params;

      const result = await service.delete(user.company_id, collaboratorId);
      
      await logAudit(req, 'FACEID_DELETE_SUCCESS', 'collaborators', collaboratorId);
      (res as any).json(result);
    } catch (err: any) {
      await logAudit(req, 'FACEID_DELETE_FAILED', 'collaborators', (req as any).params.collaboratorId, { error: err.message });
      (res as any).status(400).json({ error: err.message });
    }
  };

  verifyAndMark = async (req: Request, res: Response) => {
    const { identification } = (req as any).body;
    try {
      const user = (req as any).user;
      const { descriptor, lat, lng } = (req as any).body;

      const result = await service.verifyAndMark(user.company_id, identification, descriptor, { lat, lng });

      await logAudit(req, 'FACEID_MARK_SUCCESS', 'attendance', result.id, { 
        identification, 
        confidence: result.confidence 
      });
      
      (res as any).json(result);
    } catch (err: any) {
      // Importante: No devolver detalles técnicos sensibles al usuario final, pero sí loguearlos.
      await logAudit(req, 'FACEID_MARK_FAILED', 'attendance', undefined, { 
        identification, 
        error: err.message 
      });
      
      const statusCode = err.message.includes('No se ha registrado') ? 404 : 401;
      (res as any).status(statusCode).json({ error: err.message });
    }
  };
}
