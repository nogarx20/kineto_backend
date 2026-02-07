
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const tenantMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.company_id) {
    return res.status(400).json({ error: 'Contexto de empresa no encontrado' });
  }
  next();
};
