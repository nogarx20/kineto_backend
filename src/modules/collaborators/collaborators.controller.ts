
import { Request, Response } from 'express';
import { CollaboratorService } from './collaborators.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

const service = new CollaboratorService();

export class CollaboratorController {
  // --- Colaboradores ---
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getCollaborators(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = await service.createCollaborator(user.company_id, body);
      
      await logAudit(req, 'CREATE', 'collaborators', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;

      const [oldRows]: any = await pool.execute('SELECT * FROM collaborators WHERE id = ?', [id]);
      const oldData = oldRows[0];

      await pool.execute(`
        UPDATE collaborators 
        SET identification = ?, first_name = ?, last_name = ?, email = ?, phone = ?, 
            position_id = ?, cost_center_id = ?, is_active = ?
        WHERE id = ? AND company_id = ?
      `, [
        body.identification, body.first_name, body.last_name, 
        body.email, body.phone, body.position_id || null, 
        body.cost_center_id || null, body.is_active ? 1 : 0, 
        id, user.company_id
      ]);

      const changes: any = {};
      const fields = ['identification', 'first_name', 'last_name', 'email', 'is_active', 'position_id'];
      fields.forEach(field => {
        const newVal = field === 'is_active' ? (body[field] ? 1 : 0) : body[field];
        if (oldData && oldData[field] !== newVal) {
          changes[field] = { from: oldData[field], to: newVal };
        }
      });

      await logAudit(req, 'UPDATE', 'collaborators', id, { changes, full_payload: body });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [rows]: any = await pool.execute('SELECT * FROM collaborators WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('Colaborador no encontrado');

      await pool.execute('DELETE FROM collaborators WHERE id = ? AND company_id = ?', [id, user.company_id]);
      
      await logAudit(req, 'DELETE', 'collaborators', id, { deleted_record: rows[0] });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // --- Cargos ---
  async listPositions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getPositions(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createPosition(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { name } = (req as any).body;
      const id = await service.createPosition(user.company_id, name);
      await logAudit(req, 'CREATE_POSITION', 'positions', id, { name });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updatePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { name } = (req as any).body;
      const user = (req as any).user;
      
      const [old]: any = await pool.execute('SELECT * FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      if (old.length === 0) throw new Error('Cargo no encontrado');

      await pool.execute('UPDATE positions SET name = ? WHERE id = ? AND company_id = ?', [name, id, user.company_id]);

      await logAudit(req, 'UPDATE_POSITION', 'positions', id, { name: { from: old[0].name, to: name } });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [old]: any = await pool.execute('SELECT * FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      if (old.length === 0) throw new Error('Cargo no encontrado');

      // Validación de Integridad Referencial
      const [usage]: any = await pool.execute('SELECT COUNT(*) as count FROM collaborators WHERE position_id = ?', [id]);
      if (usage[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `Acción denegada: El cargo '${old[0].name}' tiene ${usage[0].count} colaboradores asignados actualmente.\n\nPara poder eliminar este cargo, primero debe reasignar a dichos colaboradores a un cargo diferente. Esta medida asegura que los expedientes de personal no queden con información inconsistente.`
        });
      }

      await pool.execute('DELETE FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE_POSITION', 'positions', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  // --- Centros de Costo ---
  async listCostCenters(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await service.getCostCenters(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createCostCenter(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { code, name } = (req as any).body;
      const id = await service.createCostCenter(user.company_id, code, name);
      await logAudit(req, 'CREATE_COST_CENTER', 'cost_centers', id, { code, name });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
