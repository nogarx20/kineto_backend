
import { Request, Response } from 'express';
import { ReportsService } from './reports.service';

const service = new ReportsService();

export class ReportsController {
  async getStats(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const stats = await service.getDashboardStats(user.company_id);
      (res as any).json(stats);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }
}
