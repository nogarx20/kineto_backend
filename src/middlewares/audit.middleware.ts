
import { Request } from 'express';
import pool from '../config/database';
import { generateUUID } from '../utils/uuid';

export const logAudit = async (req: Request, action: string, entity: string, entityId?: string, details?: any) => {
  try {
    const user = (req as any).user;
    const id = generateUUID();
    
    // Validar si el company_id es un UUID válido o null
    let companyId = user?.company_id;
    if (companyId === 'GLOBAL' || !companyId) {
      companyId = null;
    }

    await pool.execute(`
      INSERT INTO system_logs (id, company_id, user_id, action, entity, entity_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      companyId,
      user?.id || null,
      action,
      entity,
      entityId || null,
      (req as any).ip || null,
      details ? JSON.stringify(details) : null
    ]);
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
};
