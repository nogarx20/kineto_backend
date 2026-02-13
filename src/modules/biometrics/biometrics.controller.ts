import { Request, Response } from 'express';
import { BiometricService } from './biometrics.service';
import { logAudit } from '../../middlewares/audit.middleware';

const biometricService = new BiometricService();

export class BiometricController {
  enroll = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { collaboratorId, descriptor } = (req as any).body;

      if (!Array.isArray(descriptor)) throw new Error('Descriptor facial inválido');

      const result = await biometricService.enroll(user.company_id, collaboratorId, descriptor);
      
      await logAudit(req, 'ENROLL_FACEID', 'collaborators', collaboratorId, { 
        status: 'SUCCESS',
        provider: 'face-api-js'
      });

      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  };

  verifyAndMark = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { identification, descriptor, lat, lng } = (req as any).body;

      if (!Array.isArray(descriptor)) throw new Error('Datos biométricos incompletos');

      const result = await biometricService.verifyAndMark(
        user.company_id, 
        identification, 
        descriptor, 
        { lat, lng }
      );

      await logAudit(req, 'MARK_FACEID_SUCCESS', 'attendance', result.id, {
        identification,
        confidence: result.confidence_score
      });

      (res as any).json(result);
    } catch (err: any) {
      await logAudit(req, 'MARK_FACEID_FAILED', 'attendance', undefined, {
        error: err.message,
        identification: (req as any).body.identification
      });
      (res as any).status(401).json({ error: err.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { collaboratorId } = (req as any).params;
      
      await (biometricService as any).repository.deleteTemplate(user.company_id, collaboratorId);
      
      await logAudit(req, 'DELETE_FACEID', 'collaborators', collaboratorId);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  };
}
