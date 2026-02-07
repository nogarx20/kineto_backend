
import { Request, Response } from 'express';
import { ShiftService } from './shifts.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new ShiftService();

export class ShiftController {
  // Zones
  async listZones(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getZones(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createZone(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = await service.createZone(user.company_id, body);
      
      await logAudit(req, 'CREATE', 'marking_zones', id, { name: body.name });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // Shifts
  async listShifts(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getShifts(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createShift(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = await service.createShift(user.company_id, body);
      
      await logAudit(req, 'CREATE', 'shifts', id, { name: body.name });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
