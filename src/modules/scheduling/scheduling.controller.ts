
import { Request, Response } from 'express';
import { SchedulingService } from './scheduling.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new SchedulingService();

export class SchedulingController {
  async getWeekly(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { startDate, endDate } = (req as any).query;
      
      if (!startDate || !endDate) {
        return (res as any).status(400).json({ error: 'Fechas requeridas' });
      }

      const data = await service.getSchedule(user.company_id, startDate as string, endDate as string);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async assign(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { collaboratorId, shiftId, date, costCenterId } = (req as any).body;
      
      await service.assignShift(user.company_id, collaboratorId, shiftId, date, costCenterId);
      
      await logAudit(req, 'ASSIGN_SHIFT', 'schedules', undefined, { collaboratorId, date, costCenterId });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async bulkAssign(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { assignments } = (req as any).body; // Array de objetos
      
      const result = await service.bulkAssign(user.company_id, assignments);
      
      await logAudit(req, 'BULK_ASSIGN', 'schedules', undefined, { count: result.count });
      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      
      await (service as any).repository.delete(user.company_id, id);
      await logAudit(req, 'DELETE_SCHEDULE', 'schedules', id);
      
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
