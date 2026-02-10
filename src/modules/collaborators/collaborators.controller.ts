
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
      
      // Auditoría: Guardar objeto completo creado
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

      // 1. Obtener estado anterior para el DIFF
      const [oldRows]: any = await pool.execute('SELECT * FROM collaborators WHERE id = ?', [id]);
      const oldData = oldRows[0];

      await pool.execute(`
        UPDATE collaborators 
        SET identification = ?, first_name = ?, last_name = ?, email = ?, phone = ?, is_active = ?
        WHERE id = ? AND company_id = ?
      `, [
        body.identification, body.first_name, body.last_name, 
        body.email, body.phone, body.is_active ? 1 : 0, 
        id, user.company_id
      ]);

      // 2. Calcular diferencias
      const changes: any = {};
      const fields = ['identification', 'first_name', 'last_name', 'email', 'phone', 'is_active'];
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

      // Obtener datos antes de borrar para respaldo en logs
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
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
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
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
