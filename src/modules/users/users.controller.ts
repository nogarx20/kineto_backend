
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
      
      // Si el resultado es un login directo (token presente)
      if ((result as any).token) {
        // En caso de éxito, el company_id viene del usuario autenticado
        const userFound = (result as any).user;
        const compId = (result as any).company_id || (result as any).options?.[0]?.company_id || companyId;
        
        const fakeReq = { 
          user: { id: userFound.id, company_id: compId }, 
          ip: (req as any).ip 
        } as any;
        
        await logAudit(fakeReq, 'LOGIN_SUCCESS', 'users', userFound.id, { email });
      } else if ((result as any).multiple) {
        // Logueamos que el usuario llegó a la selección de empresas
        const fakeReq = { user: { id: null, company_id: null }, ip: (req as any).ip } as any;
        await logAudit(fakeReq, 'LOGIN_MULTIPLE_STEP', 'users', email, { email });
      }

      (res as any).json(result);
    } catch (err: any) {
      // Intento fallido: Registrar auditoría global
      const fakeReq = { 
        user: { id: null, company_id: null }, // Usamos null para que el middleware lo procese como log de sistema
        ip: (req as any).ip 
      } as any;
      
      await logAudit(fakeReq, 'LOGIN_FAILED', 'users', email, { error: err.message, attemptedEmail: email });

      (res as any).status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
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
