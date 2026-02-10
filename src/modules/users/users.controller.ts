
import { Request, Response } from 'express';
import { UserService } from './users.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

const userService = new UserService();

export class UserController {
  async login(req: Request, res: Response) {
    const { companyId, email, password } = (req as any).body;
    try {
      const result = await userService.authenticate(email, password, companyId);
      if ((result as any).token) {
        const userFound = (result as any).user;
        const compId = (result as any).company_id || companyId;
        const fakeReq = { user: { id: userFound.id, company_id: compId }, ip: (req as any).ip } as any;
        await logAudit(fakeReq, 'LOGIN_SUCCESS', 'users', userFound.id, { email });
      }
      (res as any).json(result);
    } catch (err: any) {
      const fakeReq = { user: { id: null, company_id: null }, ip: (req as any).ip } as any;
      await logAudit(fakeReq, 'LOGIN_FAILED', 'users', email, { error: err.message });
      (res as any).status(401).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { email, password, first_name, last_name, collaborator_id, role_ids } = (req as any).body;
      
      const id = await userService.createUser({
        company_id: user.company_id,
        email,
        password,
        first_name,
        last_name,
        collaborator_id: collaborator_id || null
      });

      // Asignar roles iniciales
      if (role_ids && role_ids.length > 0) {
        for (const roleId of role_ids) {
          await pool.execute('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, roleId]);
        }
      }

      await logAudit(req, 'CREATE', 'users', id, { email, linked_collaborator: !!collaborator_id });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const [rows]: any = await pool.execute(`
        SELECT p.id, p.code, p.module, 
        EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id = ? AND up.permission_id = p.id) as is_direct
        FROM permissions p
      `, [id]);
      (res as any).json(rows);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async updatePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { permission_ids } = (req as any).body;
      const user = (req as any).user;

      await pool.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      for (const pId of permission_ids) {
        await pool.execute('INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)', [id, pId]);
      }

      await logAudit(req, 'UPDATE_DIRECT_PERMISSIONS', 'users', id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [rows]: any = await pool.execute(`
        SELECT u.*, c.identification as collab_id_card 
        FROM users u 
        LEFT JOIN collaborators c ON u.collaborator_id = c.id 
        WHERE u.company_id = ?
      `, [user.company_id]);
      (res as any).json(rows);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async unlock(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      await pool.execute('UPDATE users SET is_locked = FALSE, failed_attempts = 0 WHERE id = ?', [id]);
      await logAudit(req, 'UNLOCK_USER', 'users', id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async logout(req: Request, res: Response) {
    (res as any).json({ success: true });
  }

  async forgotPassword(req: Request, res: Response) {
    (res as any).json({ message: 'Enviado' });
  }
}
