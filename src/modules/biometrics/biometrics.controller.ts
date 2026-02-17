
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
      (res as any).status(400).json({ error: err.message });
    }
  };

  identifyAndMark = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { descriptor, lat, lng } = (req as any).body;
      const result = await service.identifyAndMark(user.company_id, descriptor, { lat, lng });
      await logAudit(req, 'FACEID_IDENTIFY_SUCCESS', 'attendance', result.id, { confidence: result.confidence });
      (res as any).json(result);
    } catch (err: any) {
      await logAudit(req, 'FACEID_IDENTIFY_FAILED', 'attendance', undefined, { error: err.message });
      (res as any).status(401).json({ code: 'MATCH_FAILED', message: err.message });
    }
  };

  verifyAndMark = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { identification, descriptor, lat, lng } = (req as any).body;
      const result = await service.verifyAndMark(user.company_id, identification, descriptor, { lat, lng });
      await logAudit(req, 'FACEID_MARK_SUCCESS', 'attendance', result.id, { identification, confidence: result.confidence });
      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(401).json({ error: err.message });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { collaboratorId } = (req as any).params;
      const result = await service.delete(user.company_id, collaboratorId);
      await logAudit(req, 'FACEID_DELETE_SUCCESS', 'collaborators', collaboratorId);
      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  };
}
