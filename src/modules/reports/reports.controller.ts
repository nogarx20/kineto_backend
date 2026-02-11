
import { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new ReportsService();

export class ReportsController {
  async getStats(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const stats = await service.getDashboardStats(user.company_id);
      await logAudit(req, 'VIEW_STATS', 'reports');
      (res as any).json(stats);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async getAuditLogs(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const logs = await service.getAuditLogs(user.company_id);
      await logAudit(req, 'VIEW_AUDIT_LOGS', 'system_logs');
      (res as any).json(logs);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }
}
