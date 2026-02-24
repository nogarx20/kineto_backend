import pool from '../../config/database';

export class ReportsRepository {
  async getComplianceStats(companyId: string) {
    // Mantener compatibilidad si se usa en otros lados, o actualizar según necesidad
    const [rows]: any = await pool.query(`
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

  async getTotalActiveWorkforce(companyId: string) {
    const [rows]: any = await pool.query(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM collaborators c
      INNER JOIN contracts ct ON c.id = ct.collaborator_id
      WHERE c.company_id = ? 
      AND c.onDelete = 0
      AND c.is_active = 1
      AND ct.onDelete = 0
      AND ct.status = 'Activo'
      AND CURDATE() BETWEEN ct.start_date AND COALESCE(ct.end_date, '9999-12-31')
    `, [companyId]);
    return rows[0]?.total || 0;
  }

  async getSchedulesForDate(companyId: string, date: string) {
    const [rows]: any = await pool.query(`
      SELECT s.collaborator_id, sh.shift_type
      FROM schedules s
      INNER JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.company_id = ? AND s.date = ?
    `, [companyId, date]);
    return rows;
  }

  async getMarkingsForDate(companyId: string, date: string) {
    const [rows]: any = await pool.query(`
      SELECT collaborator_id, timestamp, is_valid_zone
      FROM attendance_records
      WHERE company_id = ? AND DATE(timestamp) = ?
    `, [companyId, date]);
    return rows;
  }

  async getTrendData(companyId: string, startDate: string, endDate: string) {
     const [rows]: any = await pool.query(`
        SELECT 
            DATE(timestamp) as date,
            COUNT(*) as ejecutado
        FROM attendance_records
        WHERE company_id = ? AND DATE(timestamp) BETWEEN ? AND ?
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
     `, [companyId, startDate, endDate]);
     return rows;
  }

  async getEnrichedRecentActivity(companyId: string, limit: number) {
    const [rows]: any = await pool.query(`
      SELECT 
        a.id, 
        a.timestamp, 
        a.type, 
        c.first_name, 
        c.last_name, 
        c.identification, 
        c.photo,
        cc.name   as cost_center
      FROM attendance_records a
      INNER JOIN collaborators c ON a.collaborator_id = c.id
      LEFT JOIN contracts con ON c.id = con.collaborator_id AND con.status = 'Activo'
      LEFT JOIN cost_centers cc ON con.cost_center_id = cc.id
      WHERE a.company_id = ?
      ORDER BY a.timestamp DESC
      LIMIT ?
    `, [companyId, limit]);
    return rows;
  }

  async getUserSecurityLogs(companyId: string, userId: string, limit: number) {
      const [rows]: any = await pool.query(`
        SELECT id, action, entity, details, createdAt
        FROM system_logs
        WHERE company_id = ? AND user_id = ?
        AND action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')
        ORDER BY createdAt DESC
        LIMIT ?
      `, [companyId, userId, limit]);
      return rows;
  }

  async getAttendanceDistribution(companyId: string) {
    const [rows]: any = await pool.query(`
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
    const [rows]: any = await pool.query(`
      SELECT COUNT(*) as count 
      FROM attendance_records 
      WHERE company_id = ? AND DATE(timestamp) = CURDATE()
    `, [companyId]);
    return rows[0]?.count || 0;
  }

  async getFailedEvents24hCount(companyId: string) {
    const [rows]: any = await pool.query(`
      SELECT COUNT(*) as count 
      FROM system_logs 
      WHERE company_id = ? 
      AND action IN ('LOGIN_FAILED', 'MARK_FAILED') 
      AND createdAt >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `, [companyId]);
    return rows[0]?.count || 0;
  }

  async getRecentAttendanceLogs(companyId: string, limit: number = 5) {
    const [rows]: any = await pool.query(`
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
    const [rows]: any = await pool.query(`
      SELECT id, action, entity, entity_id, ip_address, details, createdAt 
      FROM system_logs 
      WHERE company_id = ? 
      ORDER BY createdAt DESC 
      LIMIT 50
    `, [companyId]);
    return rows;
  }
}
