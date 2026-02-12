
import { Request, Response } from 'express';
import { NoveltyService } from './novelties.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

const service = new NoveltyService();

export class NoveltyController {
  // --- Tipos de Novedades ---
  async listTypes(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await (service as any).repository.findAllTypes(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createType(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = await service.createNoveltyType(user.company_id, body);
      await logAudit(req, 'CREATE_NOVELTY_TYPE', 'novelty_types', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateType(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const body = (req as any).body;
      await (service as any).repository.updateType(id, user.company_id, body);
      await logAudit(req, 'UPDATE_NOVELTY_TYPE', 'novelty_types', id, body);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async deleteType(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      await (service as any).repository.deleteType(id, user.company_id);
      await logAudit(req, 'DELETE_NOVELTY_TYPE', 'novelty_types', id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // --- Solicitudes de Novedades ---
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
      
      await logAudit(req, 'CREATE_NOVELTY', 'novelties', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const body = (req as any).body;
      await (service as any).repository.update(id, user.company_id, body);
      await logAudit(req, 'UPDATE_NOVELTY', 'novelties', id, body);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateStatus(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { status } = (req as any).body;
      
      const [old]: any = await pool.execute('SELECT status FROM novelties WHERE id = ?', [id]);
      
      if (status === 'Approved') await service.approveNovelty(id);
      else if (status === 'Rejected') await service.rejectNovelty(id);
      else throw new Error('Estado inválido');

      await logAudit(req, 'UPDATE_STATUS', 'novelties', id, { 
        changes: { status: { from: old[0]?.status, to: status } } 
      });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM novelties WHERE id = ?', [id]);
      await (service as any).repository.delete(id, user.company_id);
      await logAudit(req, 'DELETE_NOVELTY', 'novelties', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
