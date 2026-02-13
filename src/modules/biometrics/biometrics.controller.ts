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
      
      // 400 para errores de calidad o datos malformados
      (res as any).status(400).json({ 
        code: 'QUALITY_ERROR',
        message: err.message 
      });
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
      const errorMsg = err.message;
      let statusCode = 401; // Default: No coincide
      let errorCode = 'MATCH_FAILED';

      if (errorMsg.includes('No se ha registrado')) {
        statusCode = 404;
        errorCode = 'NOT_ENROLLED';
      } else if (errorMsg.includes('insuficiente') || errorMsg.includes('Estructura')) {
        statusCode = 400;
        errorCode = 'QUALITY_LOW';
      } else if (errorMsg.includes('inactivo')) {
        statusCode = 403;
        errorCode = 'USER_DISABLED';
      }

      await logAudit(req, 'FACEID_MARK_FAILED', 'attendance', undefined, { 
        identification, 
        errorCode,
        error: errorMsg 
      });
      
      (res as any).status(statusCode).json({ 
        code: errorCode,
        // No enviamos el mensaje técnico del error de JS al cliente
        message: 'Error en validación biométrica' 
      });
    }
  };
}
