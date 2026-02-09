import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import pool from '../config/database';

export const rbacMiddleware = (permissionCode: string) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      const user = (req as any).user;
      const [rows]: any = await pool.execute(`
        SELECT p.code 
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ? AND p.code = ?
      `, [user?.id, permissionCode]);

      if (rows.length === 0) {
        return (res as any).status(403).json({ error: 'Permisos insuficientes' });
      }

      next();
    } catch (err) {
      (res as any).status(500).json({ error: 'Error verificando permisos' });
    }
  };
};
