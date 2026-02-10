
import { Request, Response } from 'express';
import { UserService } from './users.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';

const userService = new UserService();

export class UserController {
  async login(req: Request, res: Response) {
    const { email, password } = (req as any).body;
    try {
      const result = await userService.authenticate(email, password);
      if ((result as any).token) {
        const userFound = (result as any).user;
        const fakeReq = { user: { id: userFound.id, company_id: (result as any).company_id || userFound.company_id }, ip: (req as any).ip } as any;
        await logAudit(fakeReq, 'LOGIN_SUCCESS', 'users', userFound.id, { email, timestamp: new Date() });
      }
      (res as any).json(result);
    } catch (err: any) {
      const fakeReq = { user: { id: null, company_id: null }, ip: (req as any).ip } as any;
      await logAudit(fakeReq, 'LOGIN_FAILED', 'users', email, { error: err.message, attempt_email: email });
      (res as any).status(401).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      
      const id = await userService.createUser({
        company_id: user.company_id,
        ...body
      });

      if (body.role_ids && body.role_ids.length > 0) {
        for (const rId of body.role_ids) {
          await pool.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, rId]);
        }
      }

      await logAudit(req, 'CREATE', 'users', id, body);
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

      const [oldRows]: any = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      const oldData = oldRows[0];

      await pool.execute(`
        UPDATE users 
        SET email = ?, first_name = ?, last_name = ?, collaborator_id = ?, is_locked = ? 
        WHERE id = ? AND company_id = ?
      `, [
        body.email, body.first_name, body.last_name, 
        body.collaborator_id || null, body.is_locked ? 1 : 0, 
        id, user.company_id
      ]);

      if (body.role_ids) {
        await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [id]);
        for (const rId of body.role_ids) {
          await pool.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [id, rId]);
        }
      }

      const changes: any = {};
      const fields = ['email', 'first_name', 'last_name', 'is_locked'];
      fields.forEach(field => {
        const newVal = field === 'is_locked' ? (body[field] ? 1 : 0) : body[field];
        if (oldData && oldData[field] !== newVal) {
          changes[field] = { from: oldData[field], to: newVal };
        }
      });

      await logAudit(req, 'UPDATE', 'users', id, { changes, full_payload: body });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;

      const [rows]: any = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('Usuario no encontrado');

      // Verificación estricta de logs para integridad técnica
      const [logCheck]: any = await pool.execute('SELECT COUNT(*) as log_count FROM system_logs WHERE user_id = ?', [id]);
      if (logCheck[0].log_count > 0) {
        return (res as any).status(400).json({ 
          error: 'Restricción de Integridad Forense',
          message: 'Este usuario posee registros históricos en la bitácora de auditoría y no puede ser eliminado para garantizar la trazabilidad inalterable de las acciones del sistema. Le recomendamos bloquear la cuenta para suspender el acceso sin perder los datos de cumplimiento.' 
        });
      }

      await pool.execute('DELETE FROM users WHERE id = ? AND company_id = ?', [id, user.company_id]);
      
      await logAudit(req, 'DELETE', 'users', id, { deleted_record: rows[0] });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(403).json({ error: err.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const user = (req as any).user;
      const [rows]: any = await pool.execute(`
        SELECT * FROM system_logs 
        WHERE user_id = ? AND (company_id = ? OR company_id IS NULL)
        ORDER BY createdAt DESC LIMIT 100
      `, [id, user.company_id]);
      
      const parsedRows = rows.map((r: any) => ({
        ...r,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
      }));

      (res as any).json(parsedRows);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const [rows]: any = await pool.execute(`
        SELECT u.*, (SELECT GROUP_CONCAT(role_id) FROM user_roles WHERE user_id = u.id) as role_ids_str
        FROM users u WHERE u.company_id = ?
      `, [user.company_id]);
      const usersWithRoles = rows.map((u: any) => ({ ...u, role_ids: u.role_ids_str ? u.role_ids_str.split(',') : [] }));
      (res as any).json(usersWithRoles);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      // CONSULTA MODIFICADA: Ahora solo verifica asignaciones directas en user_permissions
      // Los permisos de perfiles (roles) se gestionan en su propio módulo
      const [rows]: any = await pool.execute(`
        SELECT p.*, 
        EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id = ? AND up.permission_id = p.id) as assigned
        FROM permissions p 
        ORDER BY p.module, p.name
      `, [id]);
      
      (res as any).json(rows);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async updatePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { permission_ids } = (req as any).body;
      await pool.execute('DELETE FROM user_permissions WHERE user_id = ?', [id]);
      for (const pId of permission_ids) {
        await pool.execute('INSERT INTO user_permissions (user_id, permission_id) VALUES (?, ?)', [id, pId]);
      }
      await logAudit(req, 'UPDATE_USER_DIRECT_PERMISSIONS', 'users', id, { permission_ids });
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async unlock(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      await pool.execute('UPDATE users SET is_locked = FALSE, failed_attempts = 0 WHERE id = ?', [id]);
      await logAudit(req, 'UNLOCK', 'users', id);
      (res as any).json({ success: true });
    } catch (err: any) { (res as any).status(400).json({ error: err.message }); }
  }

  async logout(req: Request, res: Response) { (res as any).json({ success: true }); }
  async forgotPassword(req: Request, res: Response) { (res as any).json({ message: 'Enviado' }); }
}
