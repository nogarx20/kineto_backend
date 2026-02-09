import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    company_id: string;
    email: string;
  };
}

export const authMiddleware = (req: Request, res: Response, next: any) => {
  // Fix: Cast req to any to access headers property
  const authHeader = (req as any).headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return (res as any).status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (err) {
    return (res as any).status(401).json({ error: 'Token inválido' });
  }
};