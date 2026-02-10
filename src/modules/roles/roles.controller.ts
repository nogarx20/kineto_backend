
import { Request, Response } from 'express';
import { RoleService } from './roles.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

const roleService = new RoleService();

export class RoleController {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [roles]: any = await pool.execute(`
        SELECT r.*, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as perm_count
        FROM roles r WHERE r.company_id = ?
      `, [user.company_id]);
      (res as any).json(roles);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async getRolePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const [rows]: any = await pool.execute(`
        SELECT p.*, EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id = ? AND rp.permission_id = p.id) as assigned
        FROM permissions p
      `, [id]);
      (res as any).json(rows);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async updateRolePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { permission_ids } = (req as any).body;
      
      await pool.execute('DELETE FROM role_permissions WHERE role_id = ?', [id]);
      for (const pId of permission_ids) {
        await pool.execute('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, pId]);
      }

      await logAudit(req, 'UPDATE_ROLE_PERMISSIONS', 'roles', id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, description } = (req as any).body;
      const user = (req as any).user;
      const id = require('crypto').randomUUID();
      
      await pool.execute('INSERT INTO roles (id, company_id, name, description) VALUES (?, ?, ?, ?)', [
        id, user.company_id, name, description
      ]);

      await logAudit(req, 'CREATE', 'roles', id, { name });
      (res as any).status(201).json({ id, name });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async assign(req: Request, res: Response) {
    try {
      const { userId, roleId } = (req as any).body;
      await pool.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
      await logAudit(req, 'ASSIGN_ROLE', 'users', userId, { roleId });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}
