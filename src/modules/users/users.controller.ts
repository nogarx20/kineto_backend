import { Request, Response } from 'express';
import { UserService } from './users.service';
import { logAudit } from '../../middlewares/audit.middleware';
import pool from '../../config/database';
import { UserRepository } from './users.repository';

const userService = new UserService();
const repo = new UserRepository();

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
        SET email = ?, first_name = ?, last_name = ?, collaborator_id = ?, is_locked = ?, photo = ?
        WHERE id = ? AND company_id = ?
      `, [
        body.email, body.first_name, body.last_name, 
        body.collaborator_id || null, body.is_locked ? 1 : 0, body.photo || null,
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
      const adminUser = (req as any).user;

      const [rows]: any = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
      if (rows.length === 0) throw new Error('Usuario no encontrado');
      const targetUser = rows[0];

      // Verificación de integridad en múltiples tablas
      const checks = [
        { table: 'user_roles', label: 'Perfiles de Rol Asignados', query: 'SELECT COUNT(*) as count FROM user_roles WHERE user_id = ?' },
        { table: 'user_permissions', label: 'Privilegios Directos Configurados', query: 'SELECT COUNT(*) as count FROM user_permissions WHERE user_id = ?' },
        { table: 'system_logs', label: 'Historial de Auditoría Forense', query: 'SELECT COUNT(*) as count FROM system_logs WHERE user_id = ?' }
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
          error: 'Restricción de Integridad Referencial',
          message: `No es posible eliminar a ${targetUser.first_name} ${targetUser.last_name} porque el sistema detectó dependencias activas que deben preservarse para mantener la trazabilidad. Las referencias encontradas son:\n\n` + 
                   activeReferences.map(ref => `• `).join('\n') + 
                   `\n\nLe recomendamos marcar la cuenta como "Bloqueada" en lugar de eliminarla para suspender el acceso sin afectar la integridad de los datos históricos.`
        });
      }

      // Borrado lógico con onDelete
      await repo.softDelete(id, adminUser.company_id);
      
      await logAudit(req, 'DELETE', 'users', id, { deleted_record: targetUser });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async getLogs(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const { limit = 20, offset = 0, action, entity, startDate, endDate } = (req as any).query;
      const user = (req as any).user;

      let baseQuery = `FROM system_logs WHERE user_id = ? AND (company_id = ? OR company_id IS NULL)`;
      const queryParams: any[] = [id, user.company_id];

      if (action) {
        baseQuery += ` AND action = ?`;
        queryParams.push(action);
      }
      if (entity) {
        baseQuery += ` AND entity = ?`;
        queryParams.push(entity);
      }
      if (startDate) {
        baseQuery += ` AND DATE(createdAt) >= ?`;
        queryParams.push(startDate);
      }
      if (endDate) {
        baseQuery += ` AND DATE(createdAt) <= ?`;
        queryParams.push(endDate);
      }

      const [countResult]: any = await pool.execute(`SELECT COUNT(*) as total ${baseQuery}`, queryParams);
      const total = countResult[0].total;

      const [rows]: any = await pool.execute(`
        SELECT * ${baseQuery}
        ORDER BY createdAt DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `, queryParams);
      
      const parsedRows = rows.map((r: any) => ({
        ...r,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
      }));

      (res as any).json({ logs: parsedRows, total });
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const { search } = (req as any).query;
      const users = await userService.getUsers(user.company_id);
      await logAudit(req, 'LIST', 'users', undefined, { filter: search || 'all' });
      (res as any).json(users);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async getPermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const [rows]: any = await pool.execute(`
        SELECT p.*, 
        EXISTS(SELECT 1 FROM user_permissions up WHERE up.user_id = ? AND up.permission_id = p.id) as assigned
        FROM permissions p 
        ORDER BY p.module, p.name
      `, [id]);
      
      (res as any).json(rows);
    } catch (err: any) { (res as any).status(500).json({ error: err.message }); }
  }

  async getEffectivePermissions(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const [rows]: any = await pool.execute(`
        SELECT DISTINCT p.code
        FROM permissions p
        WHERE EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = ? AND rp.permission_id = p.id
        )
        OR EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = ? AND up.permission_id = p.id
        )
      `, [id, id]);
      
      const codes = rows.map((r: any) => r.code);
      (res as any).json(codes);
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

  async getSummary(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const summary = await repo.getSummary(user.company_id);
      (res as any).json(summary);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async logout(req: Request, res: Response) { (res as any).json({ success: true }); }
  async forgotPassword(req: Request, res: Response) { (res as any).json({ message: 'Enviado' }); }
}
