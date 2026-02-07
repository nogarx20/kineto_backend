
import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';

const service = new AttendanceService();

export class AttendanceController {
  async mark(req: Request, res: Response) {
    try {
      // Este endpoint puede ser llamado por un usuario autenticado (app móvil) 
      // o un kiosco (con token de empresa). Asumimos tenantMiddleware ya extrajo user o context.
      const user = (req as any).user; 
      const { identification, lat, lng } = (req as any).body;

      if (!identification) {
        return (res as any).status(400).json({ error: 'Identificación requerida' });
      }

      const result = await service.registerMarking(user.company_id, identification, lat, lng);
      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
