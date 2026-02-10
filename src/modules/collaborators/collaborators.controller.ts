
import { Request, Response } from 'express';
import { CollaboratorService } from './collaborators.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

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

      await (service as any).repository.update(id, user.company_id, body);

      await logAudit(req, 'UPDATE', 'collaborators', id, { full_payload: body });
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

      // Check references in contracts before deleting
      const [contracts]: any = await pool.execute('SELECT COUNT(*) as count FROM contracts WHERE collaborator_id = ?', [id]);
      if (contracts[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `Acción denegada: El colaborador tiene ${contracts[0].count} contratos vigentes o históricos. Debe eliminar los contratos antes de proceder.`
        });
      }

      await pool.execute('DELETE FROM collaborators WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE', 'collaborators', id, { deleted_record: rows[0] });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // --- Contratos (Nómina) ---
  async listContracts(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await (service as any).repository.listContracts(user.company_id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async createContract(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const id = generateUUID();
      await (service as any).repository.createContract({ ...body, id, company_id: user.company_id });
      await logAudit(req, 'CREATE', 'contracts', id, body);
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateContract(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;
      await (service as any).repository.updateContract(id, user.company_id, body);
      await logAudit(req, 'UPDATE', 'contracts', id, body);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async deleteContract(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [rows]: any = await pool.execute('SELECT * FROM contracts WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('Contrato no encontrado');

      await (service as any).repository.deleteContract(id, user.company_id);
      await logAudit(req, 'DELETE', 'contracts', id, { deleted_record: rows[0] });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // --- Auxiliaries ---
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
      await pool.execute('UPDATE positions SET name = ? WHERE id = ? AND company_id = ?', [name, id, user.company_id]);
      await logAudit(req, 'UPDATE_POSITION', 'positions', id, { name });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT * FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      const [usage]: any = await pool.execute('SELECT COUNT(*) as count FROM contracts WHERE position_name = ?', [old[0]?.name]);
      if (usage[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `Acción denegada: El cargo '${old[0].name}' está siendo referenciado en contratos activos.`
        });
      }
      await pool.execute('DELETE FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE_POSITION', 'positions', id, { deleted_record: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

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

  async updateCostCenter(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { code, name } = (req as any).body;
      const user = (req as any).user;
      await pool.execute('UPDATE cost_centers SET code = ?, name = ? WHERE id = ? AND company_id = ?', [code, name, id, user.company_id]);
      await logAudit(req, 'UPDATE_COST_CENTER', 'cost_centers', id, { code, name });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deleteCostCenter(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [usage]: any = await pool.execute('SELECT COUNT(*) as count FROM contracts WHERE cost_center_id = ?', [id]);
      if (usage[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `Acción denegada: El centro de costo tiene colaboradores vinculados mediante contratos.`
        });
      }
      await pool.execute('DELETE FROM cost_centers WHERE id = ? AND company_id = ?', [id, user.company_id]);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
