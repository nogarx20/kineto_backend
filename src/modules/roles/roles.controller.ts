import { Request, Response } from 'express';
import { RoleService } from './roles.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { logAudit } from '../../middlewares/audit.middleware';

const roleService = new RoleService();

export class RoleController {
  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const roles = await roleService.listRoles(user!.company_id);
      (res as any).json(roles);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const { name, permissions } = (req as any).body; // permissions es array de strings (códigos)
      const user = (req as any).user;
      const id = await roleService.createRole(user!.company_id, name, permissions);
      
      await logAudit(req, 'CREATE', 'roles', id, { name, permissions });
      (res as any).status(201).json({ id, name });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async assign(req: Request, res: Response) {
    try {
      const { userId, roleId } = (req as any).body;
      await roleService.assignRoleToUser(userId, roleId);
      
      await logAudit(req, 'ASSIGN_ROLE', 'users', userId, { roleId });
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}