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
      SELECT collaborator_id, timestamp, is_valid_zone, schedule_id
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
        a.is_valid_zone,
        c.first_name, 
        c.last_name, 
        c.identification, 
        c.photo,
        cc.name as cost_center,
        mz.name as zone_name,
        sh.name as shift_name
      FROM attendance_records a
      INNER JOIN collaborators c ON a.collaborator_id = c.id
      LEFT JOIN contracts con ON c.id = con.collaborator_id AND con.status = 'Activo'
      LEFT JOIN cost_centers cc ON con.cost_center_id = cc.id
      LEFT JOIN marking_zones mz ON a.marking_zone_id = mz.id
      LEFT JOIN schedules s ON a.schedule_id = s.id
      LEFT JOIN shifts sh ON s.shift_id = sh.id
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

  async getActivityLog(companyId: string, params: { limit: number, offset: number, search?: string, range: string, startDate?: string, endDate?: string, status?: string }) {
    let whereClause = 'a.company_id = ? AND a.onDelete = 0';
    const queryParams: any[] = [companyId];

    if (params.startDate && params.endDate) {
      whereClause += ' AND DATE(a.timestamp) BETWEEN ? AND ?';
      queryParams.push(params.startDate, params.endDate);
    } else if (params.range && params.range !== 'all') {
      let dateFilter = '';
      switch (params.range) {
        case 'today':
          dateFilter = 'DATE(a.timestamp) = CURDATE()';
          break;
        case 'yesterday':
          dateFilter = 'DATE(a.timestamp) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)';
          break;
        case 'this_week':
          dateFilter = 'YEAR(a.timestamp) = YEAR(CURDATE()) AND WEEK(a.timestamp, 1) = WEEK(CURDATE(), 1)';
          break;
        case 'last_week':
          dateFilter = 'YEAR(a.timestamp) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 WEEK)) AND WEEK(a.timestamp, 1) = WEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)';
          break;
        case 'this_month':
          dateFilter = 'MONTH(a.timestamp) = MONTH(CURDATE()) AND YEAR(a.timestamp) = YEAR(CURDATE())';
          break;
        case 'last_month':
          dateFilter = 'a.timestamp >= LAST_DAY(NOW() - INTERVAL 2 MONTH) + INTERVAL 1 DAY AND a.timestamp < LAST_DAY(NOW() - INTERVAL 1 MONTH) + INTERVAL 1 DAY';
          break;
        case 'this_year':
          dateFilter = 'YEAR(a.timestamp) = YEAR(CURDATE())';
          break;
        case 'last_year':
          dateFilter = 'YEAR(a.timestamp) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 YEAR))';
          break;
      }
      if (dateFilter) whereClause += ` AND ${dateFilter}`;
    }

    if (params.search) {
      whereClause += ` AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.identification LIKE ? OR c.email LIKE ? OR sh.name LIKE ? OR cc.name LIKE ? OR mz.name LIKE ? OR a.status LIKE ? OR a.biometric_method LIKE ?)`;
      const s = `%${params.search}%`;
      queryParams.push(s, s, s, s, s, s, s, s, s);
    }

    if (params.status && params.status !== 'All') {
      whereClause += ` AND a.status = ?`;
      queryParams.push(params.status);
    }

    const sql = `
      SELECT 
      a.id, 
      a.timestamp, 
      a.type, 
      a.status, 
      a.lat,
      a.lng,
      a.is_valid_zone,
      a.marking_zone_id,
      c.first_name, 
      c.last_name, 
      c.identification, 
      c.email, c.photo,
      sh.id AS shift_id, 
      sh.name AS shift_name,
      sh.prefix AS shift_prefix,
      sh.shift_type,
      sh.start_time AS shift_start_time,
      sh.end_time AS shift_end_time,
      sh.start_time_2 AS shift_start_time_2,
      sh.end_time_2 AS shift_end_time_2,
      sh.lunch_start,
      sh.lunch_end,
      cc.id AS cost_center_id, 
      cc.name AS cost_center_name,
      cc.code AS cost_center_code,
      mz.name AS zone_name,
      mz.lat AS zone_lat,
      mz.lng AS zone_lng,
      a.biometric_method
      FROM attendance_records a
      INNER JOIN collaborators c ON a.collaborator_id = c.id
      LEFT JOIN schedules sd ON a.schedule_id = sd.id
      LEFT JOIN shifts sh ON sd.shift_id = sh.id
      LEFT JOIN cost_centers cc ON sd.cost_center_id = cc.id
      LEFT JOIN marking_zones mz ON a.marking_zone_id = mz.id
      WHERE ${whereClause}
      ORDER BY a.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    const [rows]: any = await pool.query(sql, [...queryParams, params.limit, params.offset]);
    return rows;
  }

  async updateActivityLogEntry(id: string, data: any) {
    await pool.query('UPDATE attendance_records SET ? WHERE id = ?', [data, id]);
  }

  async getAttendanceControlData(companyId: string, date: string) {
    const sql = `
      SELECT 
        c.id as collaborator_id,
        c.first_name,
        c.last_name,
        c.identification,
        c.email,
        c.photo,
        s.id as schedule_id,
        s.date,
        sh.name as shift_name,
        sh.prefix as shift_prefix,
        sh.shift_type,
        sh.start_time,
        sh.end_time,
        sh.start_time_2,
        sh.end_time_2,
        sh.lunch_start,
        sh.lunch_end,
        cc.name as cost_center_name,
        ct.weekly_hours,
        ct.working_days,
        s.overtime_status,
        ct.discount_lunch,
        a.id as marking_id,
        a.timestamp as marking_timestamp,
        a.type as marking_type,
        a.status as marking_status,
        a.biometric_method
      FROM collaborators c
      INNER JOIN contracts ct ON c.id = ct.collaborator_id 
        AND ct.status = 'Activo' AND ct.onDelete = 0
        AND DATE(?) BETWEEN DATE(ct.start_date) AND COALESCE(DATE(ct.end_date), '9999-12-31')
      INNER JOIN schedules s ON s.collaborator_id = c.id AND DATE(s.date) = DATE(?) AND s.onDelete = 0
      INNER JOIN shifts sh ON s.shift_id = sh.id
      LEFT JOIN cost_centers cc ON s.cost_center_id = cc.id OR ct.cost_center_id = cc.id
      LEFT JOIN attendance_records a ON a.schedule_id = s.id AND a.onDelete = 0 
        AND a.status IN ('OnTime', 'EarlyEntry', 'LateEntry', 'EarlyDeparture', 'LateDeparture')
      WHERE c.company_id = ? AND c.onDelete = 0
      ORDER BY c.last_name, c.first_name, a.timestamp ASC
    `;
    const [rows]: any = await pool.query(sql, [date, date, companyId]);
    return rows;
  }

  async updateOvertimeStatus(companyId: string, scheduleId: string, status: string) {
    await pool.execute('UPDATE schedules SET overtime_status = ? WHERE id = ? AND company_id = ?', [status, scheduleId, companyId]);
  }
}
