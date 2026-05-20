import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

export const tenantMiddleware = (req: Request, res: Response, next: any) => {
  const user = (req as any).user;
  if (!user || !user.company_id) {
    return (res as any).status(400).json({ error: 'Contexto de empresa no encontrado' });
  }
  next();
};
