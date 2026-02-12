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
      
      // Registro de auditoría para la consulta de geocercas
      await logAudit(req, 'LIST', 'marking_zones');
      
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
      const [oldRows]: any = await pool.execute('SELECT * FROM marking_zones WHERE id = ?', [id]);
      const oldData = oldRows[0];
      
      await pool.execute(
        'UPDATE marking_zones SET name = ?, lat = ?, lng = ?, radius = ?, zone_type = ?, bounds = ? WHERE id = ? AND company_id = ?',
        [body.name, body.lat, body.lng, body.radius, body.zone_type || 'circle', body.bounds ? JSON.stringify(body.bounds) : null, id, user.company_id]
      );

      const changes: any = {};
      const fields = ['name', 'lat', 'lng', 'radius', 'zone_type'];
      fields.forEach(f => {
        if (oldData && oldData[f] != body[f]) {
          changes[f] = { from: oldData[f], to: body[f] };
        }
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
      
      // Registro de auditoría para la consulta de turnos operativos
      await logAudit(req, 'LIST', 'shifts');

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
      const [oldRows]: any = await pool.execute('SELECT * FROM shifts WHERE id = ?', [id]);
      const oldData = oldRows[0];
      
      await pool.execute(`
        UPDATE shifts 
        SET name = ?, prefix = ?, shift_type = ?, 
            start_time = ?, end_time = ?, start_time_2 = ?, end_time_2 = ?,
            entry_start_buffer = ?, entry_end_buffer = ?, exit_start_buffer = ?, exit_end_buffer = ?,
            entry_start_buffer_2 = ?, entry_end_buffer_2 = ?, exit_start_buffer_2 = ?, exit_end_buffer_2 = ?,
            rounding = ?, lunch_start = ?, lunch_end = ?, marking_zone_id = ?
        WHERE id = ? AND company_id = ?
      `, [
        body.name, body.prefix, body.shift_type || 'Simple',
        body.start_time, body.end_time, body.start_time_2 || null, body.end_time_2 || null,
        body.entry_start_buffer || 15, body.entry_end_buffer || 15, body.exit_start_buffer || 15, body.exit_end_buffer || 15,
        // Fix: Added body. prefix to exit_start_buffer_2 and exit_end_buffer_2 to resolve "Cannot find name" errors.
        body.entry_start_buffer_2 || 15, body.entry_end_buffer_2 || 15, body.exit_start_buffer_2 || 15, body.exit_end_buffer_2 || 15,
        body.rounding || 0, body.lunch_start || null, body.lunch_end || null, body.marking_zone_id || null,
        id, user.company_id
      ]);

      const changes: any = {};
      const fields = ['name', 'prefix', 'shift_type', 'start_time', 'end_time', 'marking_zone_id'];
      fields.forEach(f => {
        if (oldData && oldData[f] != body[f]) {
          changes[f] = { from: oldData[f], to: body[f] };
        }
      });

      await logAudit(req, 'UPDATE', 'shifts', id, { changes, payload: body });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deleteShift(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      // RESTRICCIÓN: Verificar si el turno está asignado en la programación
      const [usage]: any = await pool.execute(
        'SELECT COUNT(*) as count FROM schedules WHERE shift_id = ? AND company_id = ?',
        [id, user.company_id]
      );

      if (usage[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `No es posible eliminar este turno porque tiene ${usage[0].count} asignaciones registradas en la programación activa. Debe eliminar o reasignar estos registros antes de proceder.`
        });
      }

      const [old]: any = await pool.execute('SELECT * FROM shifts WHERE id = ?', [id]);
      await pool.execute('DELETE FROM shifts WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE', 'shifts', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
