
import { Request, Response } from 'express';
import pool from '../config/database';

export const rbacMiddleware = (permissionCode: string) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      const user = (req as any).user;
      
      if (!user || !user.id) {
        return (res as any).status(401).json({ error: 'Sesión no válida o expirada' });
      }

      // Consulta de permisos con lógica de herencia (Roles + Directos)
      // Se utiliza pool.query para asegurar que se tome una conexión fresca del pool keep-alive
      const [rows]: any = await pool.query(`
        SELECT COUNT(*) as has_permission
        FROM permissions p
        WHERE p.code = ? AND (
          -- Vía Roles asignados
          EXISTS (
            SELECT 1 FROM role_permissions rp
            JOIN user_roles ur ON rp.role_id = ur.role_id
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ? AND rp.permission_id = p.id AND r.is_active = 1
          )
          OR
          -- Vía Permisos directos
          EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE up.user_id = ? AND up.permission_id = p.id
          )
        )
      `, [permissionCode, user.id, user.id]);

      if (!rows || rows[0].has_permission === 0) {
        console.warn(`[RBAC] Acceso denegado: Usuario ${user.id} intentó acceder a ${permissionCode}`);
        return (res as any).status(403).json({ 
          error: `Privilegios insuficientes`, 
          required_permission: permissionCode 
        });
      }

      next();
    } catch (err: any) {
      console.error('[RBAC Error Critical]:', err.message);
      
      // Si el error es de conexión, intentamos informar al cliente para que reintente
      if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNREFUSED') {
        return (res as any).status(503).json({ error: 'El servicio de seguridad está temporalmente ocupado. Por favor, reintente en un momento.' });
      }
      
      (res as any).status(500).json({ error: 'Error verificando seguridad del entorno' });
    }
  };
};
