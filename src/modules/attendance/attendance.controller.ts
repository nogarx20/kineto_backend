import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';

const service = new AttendanceService();

export class AttendanceController {
  async mark(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { identification, lat, lng } = req.body;
      const result = await service.registerMarking(user.company_id, { identification, lat, lng });
      (res as any).json(result);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async getRecordsBySchedule(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { scheduleId } = req.params;

      if (!scheduleId) return (res as any).status(400).json({ error: 'ID de turno requerido' });

      const records = await service.getAttendanceRecordsBySchedule(user.company_id, scheduleId as string);
      (res as any).json(records);
    } catch (err: any) {
      console.error('[AttendanceController] Error fetching records by schedule:', err);
      (res as any).status(500).json({ error: err.message });
    }
  }
}
