
import { Request, Response } from 'express';
import { ShiftService } from './shifts.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

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
      await logAudit(req, 'CREATE', 'marking_zones', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateZone(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM marking_zones WHERE id = ?', [id]);
      
      await pool.execute(
        'UPDATE marking_zones SET name = ?, lat = ?, lng = ?, radius = ? WHERE id = ? AND company_id = ?',
        [body.name, body.lat, body.lng, body.radius, id, user.company_id]
      );

      const changes: any = {};
      const fields = ['name', 'lat', 'lng', 'radius'];
      fields.forEach(f => {
        if (old[0] && old[0][f] != body[f]) changes[f] = { from: old[0][f], to: body[f] };
      });

      await logAudit(req, 'UPDATE', 'marking_zones', id, { changes, payload: body });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deleteZone(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM marking_zones WHERE id = ?', [id]);
      await pool.execute('DELETE FROM marking_zones WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE', 'marking_zones', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
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
      await logAudit(req, 'CREATE', 'shifts', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateShift(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM shifts WHERE id = ?', [id]);
      
      await pool.execute(`
        UPDATE shifts 
        SET name = ?, prefix = ?, start_time = ?, end_time = ?, 
            entry_buffer_minutes = ?, exit_buffer_minutes = ?, marking_zone_id = ?
        WHERE id = ? AND company_id = ?
      `, [
        body.name, body.prefix, body.start_time, body.end_time, 
        body.entry_buffer_minutes, body.exit_buffer_minutes, body.marking_zone_id || null, 
        id, user.company_id
      ]);

      const changes: any = {};
      const fields = ['name', 'prefix', 'start_time', 'end_time', 'marking_zone_id'];
      fields.forEach(f => {
        if (old[0] && old[0][f] !== body[f]) changes[f] = { from: old[0][f], to: body[f] };
      });

      await logAudit(req, 'UPDATE', 'shifts', id, { changes, payload: body });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deleteShift(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM shifts WHERE id = ?', [id]);
      await pool.execute('DELETE FROM shifts WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE', 'shifts', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
