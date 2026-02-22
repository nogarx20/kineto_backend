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
      const data = await service.findAll(user.company_id);
      await logAudit(req, 'LIST', 'collaborators');
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      // Forzar activo por defecto en creación
      const id = await service.create(user.company_id, { ...body });
      
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

      // Validación de regla de negocio: No inactivar si existen contratos activos
      if (body.status === 'Inactive' || body.status === 'Rejected') {
        const [activeContracts]: any = await pool.execute(
          'SELECT COUNT(*) as count FROM contracts WHERE collaborator_id = ? AND status = "Activo" AND company_id = ? AND onDelete = 0',
          [id, user.company_id]
        );
        if (activeContracts[0].count > 0) {
          throw new Error(`Acción Denegada: El colaborador posee ${activeContracts[0].count} contrato(s) con estado "Activo". Debe finalizar o cancelar los contratos vigentes antes de proceder a inactivar el perfil.`);
        }
      }

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

      const checks = [
        { table: 'contracts', label: 'Contratos Laborales', query: 'SELECT COUNT(*) as count FROM contracts WHERE collaborator_id = ? AND onDelete = 0' },
        { table: 'schedules', label: 'Programación de Turnos', query: 'SELECT COUNT(*) as count FROM schedules WHERE collaborator_id = ? AND onDelete = 0' },
        { table: 'attendance_records', label: 'Marcajes de Asistencia', query: 'SELECT COUNT(*) as count FROM attendance_records WHERE collaborator_id = ?' },
        { table: 'novelties', label: 'Novedades y Licencias', query: 'SELECT COUNT(*) as count FROM novelties WHERE collaborator_id = ? AND onDelete = 0' }
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
          message: `Acción denegada: El colaborador posee registros vinculados que impiden su eliminación directa:\n\n` + 
                   activeReferences.map(ref => `• ${ref}`).join('\n') + 
                   `\n\nDebe eliminar estas dependencias antes de proceder con el borrado definitivo.`
        });
      }

      const [oldCollab]: any = await pool.execute('SELECT first_name, last_name, identification FROM collaborators WHERE id = ?', [id]);
      
      // Borrado lógico con onDelete
      await (service as any).repository.delete(id, user.company_id);
      
      await logAudit(req, 'DELETE', 'collaborators', id, { deleted_record: oldCollab[0] });
      
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async getFingerprints(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const data = await (service as any).repository.getFingerprints(id);
      (res as any).json(data);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  // --- Contratos (Nómina) ---
  async listContracts(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const data = await (service as any).repository.listContracts(user.company_id);
      await logAudit(req, 'LIST', 'contracts');
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

      // Obtener prefijo del CC
      const [cc]: any = await pool.execute('SELECT code FROM cost_centers WHERE id = ?', [body.cost_center_id]);
      const prefix = cc[0]?.code || 'CON';

      // Obtener el siguiente consecutivo real buscando el MAX actual numérico
      const [maxRows]: any = await pool.execute(`
        SELECT MAX(CAST(SUBSTRING_INDEX(contract_code, '-', -1) AS UNSIGNED)) as max_serial 
        FROM contracts 
        WHERE company_id = ? AND cost_center_id = ?
      `, [user.company_id, body.cost_center_id]);
      
      const nextSerial = (maxRows[0].max_serial || 0) + 1;
      // Componer código: Prefijo + consecutivo de 4 cifras rellenado con 0
      const contract_code = `${prefix}-${nextSerial.toString().padStart(4, '0')}`;

      await (service as any).repository.createContract({ 
        ...body, 
        id, 
        company_id: user.company_id, 
        contract_code, 
        status: body.status || 'Activo' 
      });
      
      await logAudit(req, 'CREATE', 'contracts', id, { contract_code, collaborator_id: body.collaborator_id });
      
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

      await (service as any).repository.updateContract(id, user.company_id, body);
      
      await logAudit(req, 'UPDATE', 'contracts', id, { payload: body });
      
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async deleteContract(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [con]: any = await pool.execute('SELECT contract_code FROM contracts WHERE id = ?', [id]);
      if (con.length === 0) throw new Error('Contrato no encontrado');

      // Borrado lógico con onDelete
      await (service as any).repository.deleteContract(id, user.company_id);
      
      await logAudit(req, 'DELETE', 'contracts', id, { contract_code: con[0].contract_code });
      
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  // --- Auxiliares ---
  async listPositions(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [data]: any = await pool.execute(`
        SELECT p.*, 
        (SELECT COUNT(*) FROM contracts WHERE position_name = p.name AND company_id = p.company_id AND status = 'Activo' AND onDelete = 0) as active_count,
        (SELECT COUNT(*) FROM contracts WHERE position_name = p.name AND company_id = p.company_id AND status != 'Activo' AND onDelete = 0) as inactive_count
        FROM positions p 
        WHERE p.company_id = ? AND p.onDelete = 0
      `, [user.company_id]);
      await logAudit(req, 'LIST', 'positions');
      (res as any).json(data);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async createPosition(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { name, is_active } = (req as any).body;
      const id = generateUUID();
      await (service as any).repository.createPosition({ id, company_id: user.company_id, name, is_active });
      await logAudit(req, 'CREATE', 'positions', id, { name, is_active });
      (res as any).status(201).json({ id });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async updatePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { name, is_active } = (req as any).body;
      const user = (req as any).user;
      await (service as any).repository.updatePosition(id, user.company_id, { name, is_active });
      await logAudit(req, 'UPDATE', 'positions', id, { name, is_active });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deletePosition(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      await (service as any).repository.deletePosition(id, user.company_id);
      await logAudit(req, 'DELETE', 'positions', id);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async listCostCenters(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [data]: any = await pool.execute(`
        SELECT cc.*, 
        (SELECT COUNT(*) FROM contracts WHERE cost_center_id = cc.id AND company_id = cc.company_id AND status = 'Activo' AND onDelete = 0) as active_count,
        (SELECT COUNT(*) FROM contracts WHERE cost_center_id = cc.id AND company_id = cc.company_id AND status != 'Activo' AND onDelete = 0) as inactive_count,
        (SELECT COUNT(*) FROM contracts WHERE cost_center_id = cc.id AND company_id = cc.company_id AND onDelete = 0) as total_count
        FROM cost_centers cc 
        WHERE cc.company_id = ? AND cc.onDelete = 0
      `, [user.company_id]);
      await logAudit(req, 'LIST', 'cost_centers');
      (res as any).json(data);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async createCostCenter(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { code, name, is_active } = (req as any).body;
      const id = generateUUID();
      await (service as any).repository.createCostCenter({ id, company_id: user.company_id, code, name, is_active });
      await logAudit(req, 'CREATE', 'cost_centers', id, { code, name, is_active });
      (res as any).status(201).json({ id });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async updateCostCenter(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { code, name, is_active } = (req as any).body;
      const user = (req as any).user;

      // Validación: No inactivar si tiene contratos activos
      if (is_active === false || is_active === 0) {
        const [activeContracts]: any = await pool.execute(
          'SELECT COUNT(*) as count FROM contracts WHERE cost_center_id = ? AND status = "Activo" AND company_id = ? AND onDelete = 0',
          [id, user.company_id]
        );
        if (activeContracts[0].count > 0) {
          throw new Error(`Acción Denegada: El centro de costo posee ${activeContracts[0].count} contrato(s) activos. Debe reasignarlos antes de inactivar.`);
        }
      }

      await (service as any).repository.updateCostCenter(id, user.company_id, { code, name, is_active });
      await logAudit(req, 'UPDATE', 'cost_centers', id, { code, name, is_active });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async deleteCostCenter(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      await (service as any).repository.deleteCostCenter(id, user.company_id);
      await logAudit(req, 'DELETE', 'cost_centers', id);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
