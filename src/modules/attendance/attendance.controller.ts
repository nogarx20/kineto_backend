
import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new AttendanceService();

export class AttendanceController {
  async mark(req: Request, res: Response) {
    try {
      const user = (req as any).user; 
      const { identification, lat, lng } = (req as any).body;

      if (!identification) {
        return (res as any).status(400).json({ error: 'Identificación requerida' });
      }

      const result = await service.registerMarking(user.company_id, identification, lat, lng);
      
      // Auditoría: Registro forense del intento de marcaje
      await logAudit(req, 'MARK_ATTENDANCE', 'attendance', result.id, {
        identification,
        coords: { lat, lng },
        result: { status: result.status, type: result.type }
      });

      (res as any).json(result);
    } catch (err: any) {
      // Registrar intento fallido
      await logAudit(req, 'MARK_FAILED', 'attendance', undefined, { 
        error: err.message, 
        identification: (req as any).body.identification 
      });
      (res as any).status(400).json({ error: err.message });
    }
  }
}
