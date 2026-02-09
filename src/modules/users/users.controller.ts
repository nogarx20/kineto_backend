
import { Request, Response } from 'express';
import { UserService } from './users.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { logAudit } from '../../middlewares/audit.middleware';

const userService = new UserService();

export class UserController {
  async login(req: Request, res: Response) {
    const { companyId, email, password } = (req as any).body;

    try {
      const result = await userService.authenticate(email, password, companyId);
      
      if ((result as any).token) {
        const userFound = (result as any).user;
        const compId = (result as any).company_id || (result as any).options?.[0]?.company_id || companyId;
        
        const fakeReq = { 
          user: { id: userFound.id, company_id: compId }, 
          ip: (req as any).ip 
        } as any;
        
        await logAudit(fakeReq, 'LOGIN_SUCCESS', 'users', userFound.id, { email });
      }

      (res as any).json(result);
    } catch (err: any) {
      const fakeReq = { user: { id: null, company_id: null }, ip: (req as any).ip } as any;
      await logAudit(fakeReq, 'LOGIN_FAILED', 'users', email, { error: err.message });
      (res as any).status(401).json({ error: err.message });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      await logAudit(req, 'LOGOUT_SUCCESS', 'users', user?.id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
        const { email } = (req as any).body;
        const result = await userService.forgotPassword(email);
        
        // Log de auditoría para la solicitud de recuperación
        const fakeReq = { user: { id: null, company_id: null }, ip: (req as any).ip } as any;
        await logAudit(fakeReq, 'PASSWORD_RECOVERY_REQUEST', 'users', email, { email });
        
        (res as any).json(result);
    } catch (err: any) {
        (res as any).status(200).json({ success: true, message: 'Si el correo existe, recibirá instrucciones.' });
    }
  }

  async unlock(req: Request, res: Response) {
    try {
        const user = (req as any).user;
        const { id } = (req as any).params;
        const result = await userService.unlockUser(user.company_id, id);
        await logAudit(req, 'UNLOCK_USER', 'users', id);
        (res as any).json(result);
    } catch (err: any) {
        (res as any).status(400).json({ error: err.message });
    }
  }

  async create(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const body = (req as any).body;
      const data = { ...body, company_id: user?.company_id };
      const id = await userService.createUser(data);
      await logAudit(req, 'CREATE', 'users', id, { email: data.email });
      (res as any).status(201).json({ id });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const users = await userService.getUsers(user!.company_id);
      (res as any).json(users);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }
}
