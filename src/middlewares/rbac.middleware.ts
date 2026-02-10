
import { Request, Response } from 'express';
import pool from '../config/database';

export const rbacMiddleware = (permissionCode: string) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      const user = (req as any).user;
      
      // Query que busca el permiso en los ROLES del usuario O en los PERMISOS DIRECTOS
      // Si el COUNT es > 0, tiene el permiso (Lógica Afirmativa)
      const [rows]: any = await pool.execute(`
        SELECT COUNT(*) as has_permission
        FROM permissions p
        WHERE p.code = ? AND (
          -- Opción A: Permiso vía Rol
          EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN user_roles ur ON rp.role_id = ur.role_id
            WHERE ur.user_id = ? AND rp.permission_id = p.id
          )
          OR
          -- Opción B: Permiso directo al Usuario
          EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = ? AND up.permission_id = p.id
          )
        )
      `, [permissionCode, user?.id, user?.id]);

      if (rows[0].has_permission === 0) {
        return (res as any).status(403).json({ error: `Permisos insuficientes para la acción: ${permissionCode}` });
      }

      next();
    } catch (err) {
      console.error('RBAC Error:', err);
      (res as any).status(500).json({ error: 'Error verificando seguridad' });
    }
  };
};
