import pool from '../../config/database';

export class ReportsRepository {
  async getComplianceStats(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        c.id, 
        CONCAT(c.first_name, ' ', c.last_name) as name,
        COALESCE(COUNT(DISTINCT s.id), 0) as programado,
        COALESCE(COUNT(DISTINCT a.id), 0) as ejecutado,
        COALESCE(SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END), 0) as late_count
      FROM collaborators c
      INNER JOIN contracts con ON c.id = con.collaborator_id AND con.status = 'Activo'
      LEFT JOIN schedules s ON c.id = s.collaborator_id AND s.date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
      LEFT JOIN attendance_records a ON c.id = a.collaborator_id AND a.timestamp BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND NOW()
      WHERE c.company_id = ?
      GROUP BY c.id
      ORDER BY ejecutado DESC
      LIMIT 10
    `, [companyId]);
    return rows;
  }

  async getAttendanceDistribution(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        COALESCE(status, 'Unknown') as status, 
        COUNT(*) as count 
      FROM attendance_records 
      WHERE company_id = ? AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY status
    `, [companyId]);
    return rows;
  }

  async getTodayMarkingsCount(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM system_logs 
      WHERE company_id = ? AND action = 'MARK_ATTENDANCE' AND DATE(createdAt) = CURDATE()
    `, [companyId]);
    return rows[0]?.count || 0;
  }

  async getFailedEvents24hCount(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM system_logs 
      WHERE company_id = ? 
      AND action IN ('LOGIN_FAILED', 'MARK_FAILED') 
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `, [companyId]);
    return rows[0]?.count || 0;
  }

  async getRecentAttendanceLogs(companyId: string, limit: number = 5) {
    const [rows]: any = await pool.execute(`
      SELECT id, action, entity, entity_id, ip_address, details, createdAt 
      FROM system_logs 
      WHERE company_id = ? 
      AND action IN ('MARK_ATTENDANCE', 'MARK_FAILED')
      ORDER BY createdAt DESC 
      LIMIT ?
    `, [companyId, limit]);
    return rows;
  }

  async getAuditLogs(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT id, action, entity, entity_id, ip_address, details, createdAt 
      FROM system_logs 
      WHERE company_id = ? 
      ORDER BY createdAt DESC 
      LIMIT 50
    `, [companyId]);
    return rows;
  }
}
