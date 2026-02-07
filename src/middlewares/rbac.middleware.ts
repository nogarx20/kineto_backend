
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import pool from '../config/database';

export const rbacMiddleware = (permissionCode: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const [rows]: any = await pool.execute(`
        SELECT p.code 
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ? AND p.code = ?
      `, [req.user?.id, permissionCode]);

      if (rows.length === 0) {
        return res.status(403).json({ error: 'Permisos insuficientes' });
      }

      next();
    } catch (err) {
      res.status(500).json({ error: 'Error verificando permisos' });
    }
  };
};
