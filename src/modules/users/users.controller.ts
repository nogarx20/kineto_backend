
import { Response } from 'express';
import { UserService } from './users.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { logAudit } from '../../middlewares/audit.middleware';

const userService = new UserService();

export class UserController {
  async login(req: any, res: Response) {
    try {
      const { companyId, email, password } = req.body;
      const result = await userService.authenticate(companyId, email, password);
      
      // Audit login (fake request object since user is not in req yet)
      const fakeReq = { user: { id: result.user.id, company_id: companyId }, ip: req.ip } as any;
      await logAudit(fakeReq, 'LOGIN', 'users', result.user.id);

      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      // Fix: Cast req to any to access body property which is reported as missing on AuthenticatedRequest
      const data = { ...(req as any).body, company_id: req.user?.company_id };
      const id = await userService.createUser(data);
      
      await logAudit(req, 'CREATE', 'users', id, { email: data.email });

      res.status(201).json({ id });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }

  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await userService.getUsers(req.user!.company_id);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
