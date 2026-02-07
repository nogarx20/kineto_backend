
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import pool from '../config/database';
import { generateUUID } from '../utils/uuid';

export const logAudit = async (req: AuthenticatedRequest, action: string, entity: string, entityId?: string, details?: any) => {
  try {
    const id = generateUUID();
    await pool.execute(`
      INSERT INTO system_logs (id, company_id, user_id, action, entity, entity_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      req.user?.company_id,
      req.user?.id,
      action,
      entity,
      entityId || null,
      // Fix: Cast req to any to access ip property which is reported as missing on AuthenticatedRequest
      (req as any).ip,
      details ? JSON.stringify(details) : null
    ]);
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};
