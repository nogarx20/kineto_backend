import { Request, Response } from 'express';
import { NoveltyService } from './novelties.service';
import { logAudit } from '../../middlewares/audit.middleware';

const service = new NoveltyService();

export class NoveltyController {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getNovelties(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = await service.createNovelty(user.company_id, body);
      
      await logAudit(req, 'CREATE', 'novelties', id, { type: body.type });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { status } = (req as any).body; // 'Approved' | 'Rejected'
      
      if (status === 'Approved') await service.approveNovelty(id);
      else if (status === 'Rejected') await service.rejectNovelty(id);
      else throw new Error('Estado inválido');

      await logAudit(req, 'UPDATE_STATUS', 'novelties', id, { status });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}