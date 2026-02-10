
import { Request, Response } from 'express';
import { RoleService } from './roles.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

const roleService = new RoleService();

export class RoleController {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [roles]: any = await pool.execute(`
        SELECT r.*, 
        (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) as user_count
        FROM roles r WHERE r.company_id = ?
      `, [user.company_id]);
      (res as any).json(roles);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async create(req: Request, res: Response) {
    try {
      const body = (req as any).body;
      const user = (req as any).user;
      const id = generateUUID();
      
      await pool.execute('INSERT INTO roles (id, company_id, name, description) VALUES (?, ?, ?, ?)', [
        id, user.company_id, body.name, body.description || null
      ]);

      await logAudit(req, 'CREATE', 'roles', id, body);
      (res as any).status(201).json({ id, name: body.name });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      const user = (req as any).user;

      const [oldRows]: any = await pool.execute('SELECT * FROM roles WHERE id = ?', [id]);
      const oldData = oldRows[0];
      
      await pool.execute('UPDATE roles SET name = ?, description = ? WHERE id = ? AND company_id = ?', [
        body.name, body.description, id, user.company_id
      ]);

      const changes: any = {};
      if (oldData) {
        if (oldData.name !== body.name) changes.name = { from: oldData.name, to: body.name };
        if (oldData.description !== body.description) changes.description = { from: oldData.description, to: body.description };
      }

      await logAudit(req, 'UPDATE', 'roles', id, { changes, full_payload: body });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [old]: any = await pool.execute('SELECT * FROM roles WHERE id = ? AND company_id = ?', [id, user.company_id]);
      if (old.length === 0) throw new Error('Rol no encontrado');

      // VALIDACIÓN CRÍTICA: Impedir eliminación si hay usuarios vinculados
      const [users]: any = await pool.execute('SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?', [id]);
      if (users[0].count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad',
          message: `No es posible eliminar el rol '${old[0].name}' porque tiene ${users[0].count} usuarios asignados. Debe desvincular a los usuarios de este perfil antes de proceder para garantizar la consistencia de los permisos.` 
        });
      }

      await pool.execute('DELETE FROM roles WHERE id = ? AND company_id = ?', [id, user.company_id]);
      await logAudit(req, 'DELETE', 'roles', id, { deleted_role: old[0] });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async getRolePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const [rows]: any = await pool.execute(`
        SELECT p.*, EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id = ? AND rp.permission_id = p.id) as assigned
        FROM permissions p ORDER BY p.module, p.name
      `, [id]);
      (res as any).json(rows);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async updateRolePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { permission_ids } = (req as any).body;
      
      await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      for (const pId of permission_ids) {
        await pool.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, pId]);
      }
      
      await logAudit(req, 'UPDATE_ROLE_PERMISSIONS', 'roles', id, { permission_count: permission_ids.length });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }
}
