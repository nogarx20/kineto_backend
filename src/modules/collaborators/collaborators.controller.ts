
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

      // Verificación de integridad en múltiples tablas
      const checks = [
        { table: 'contracts', label: 'Contratos Laborales', query: 'SELECT COUNT(*) as count FROM contracts WHERE collaborator_id = ?' },
        { table: 'schedules', label: 'Programación de Turnos', query: 'SELECT COUNT(*) as count FROM schedules WHERE collaborator_id = ?' },
        { table: 'attendance_records', label: 'Marcajes de Asistencia', query: 'SELECT COUNT(*) as count FROM attendance_records WHERE collaborator_id = ?' },
        { table: 'novelties', label: 'Novedades y Licencias', query: 'SELECT COUNT(*) as count FROM novelties WHERE collaborator_id = ?' }
      ];

      const activeReferences = [];
      for (const check of checks) {
        const [result]: any = await pool.execute(check.query, [id]);
        if (result[0].count > 0) {
          activeReferences.push(`${check.label} (${result[0].count} registros)`);
        }
      }

      if (activeReferences.length > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `Acción denegada: El colaborador posee registros vinculados en:\n\n` + 
                   activeReferences.map(ref => `• ${ref}`).join('\n') + 
                   `\n\nDebe eliminar estas dependencias antes de proceder con el borrado definitivo.`
        });
      }

      await pool.execute('DELETE FROM collaborators WHERE id = ? AND company_id = ?', [id, user.company_id]);
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

      // Esquema de Código automático: PREFIX_CC-CONSECUTIVO
      const [cc]: any = await pool.execute('SELECT code FROM cost_centers WHERE id = ?', [body.cost_center_id]);
      const prefix = cc[0]?.code || 'CON';
      const [count]: any = await pool.execute('SELECT COUNT(*) as count FROM contracts WHERE company_id = ? AND cost_center_id = ?', [user.company_id, body.cost_center_id]);
      const serial = (count[0].count + 1).toString().padStart(3, '0');
      const contract_code = `${prefix}-${serial}`;

      // Lógica de estado inicial
      let status = body.status || 'Activo';
      if (body.end_date) status = 'Inactivo';

      await (service as any).repository.createContract({ ...body, id, company_id: user.company_id, contract_code, status });
      (res as any).status(201).json({ id, contract_code });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async updateContract(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;

      // Validación de regla de negocio para estado Inactivo
      if (body.status === 'Inactivo' && !body.end_date) {
        throw new Error('El estado "Inactivo" requiere obligatoriamente una fecha de terminación.');
      }

      await (service as any).repository.updateContract(id, user.company_id, body);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async deleteContract(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [usage]: any = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM schedules WHERE collaborator_id = (SELECT collaborator_id FROM contracts WHERE id = ?) AND company_id = ?) as schedules_count,
          (SELECT COUNT(*) FROM attendance_records WHERE collaborator_id = (SELECT collaborator_id FROM contracts WHERE id = ?) AND company_id = ?) as attendance_count
      `, [id, user.company_id, id, user.company_id]);

      const activeRefs = [];
      if (usage[0].schedules_count > 0) activeRefs.push(`Programación de Turnos (${usage[0].schedules_count} registros)`);
      if (usage[0].attendance_count > 0) activeRefs.push(`Marcajes de Asistencia (${usage[0].attendance_count} registros)`);

      if (activeRefs.length > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `No se puede eliminar el contrato porque existen registros históricos asociados en:\n\n` + 
                   activeRefs.map(ref => `• ${ref}`).join('\n') + 
                   `\n\nSe recomienda cambiar el estado del contrato a "Cancelado".`
        });
      }

      await (service as any).repository.deleteContract(id, user.company_id);
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
      (res as any).status(201).json({ id });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async updatePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { name } = (req as any).body;
      const user = (req as any).user;
      await pool.execute('UPDATE positions SET name = ? WHERE id = ? AND company_id = ?', [name, id, user.company_id]);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [old]: any = await pool.execute('SELECT name FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
      const [usage]: any = await pool.execute('SELECT COUNT(*) as count FROM contracts WHERE position_name = ?', [old[0]?.name]);
      if (usage[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `El cargo '${old[0].name}' está en uso en ${usage[0].count} contratos y no puede ser eliminado.`
        });
      }
      await pool.execute('DELETE FROM positions WHERE id = ? AND company_id = ?', [id, user.company_id]);
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
      (res as any).status(201).json({ id });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async updateCostCenter(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { code, name } = (req as any).body;
      const user = (req as any).user;
      await pool.execute('UPDATE cost_centers SET code = ?, name = ? WHERE id = ? AND company_id = ?', [code, name, id, user.company_id]);
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
          message: `El centro de costo tiene ${usage[0].count} contratos activos vinculados.`
        });
      }
      await pool.execute('DELETE FROM cost_centers WHERE id = ? AND company_id = ?', [id, user.company_id]);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
