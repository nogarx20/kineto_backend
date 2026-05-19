import pool from '../../config/database';

export class SchedulingRepository {
  async findByDateRange(companyId: string, startDate: string, endDate: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        s.*, 
        sh.name as shift_name, 
        sh.prefix as shift_prefix, 
        sh.shift_type,
        sh.start_time, 
        sh.end_time,
        sh.start_time_2,
        sh.end_time_2,
        sh.lunch_start,
        sh.lunch_end,
        cc.code as cost_center_code,
        mz.name as zone_name,
        c.first_name, 
        c.last_name,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.schedule_id = s.id) > 0 as has_attendance,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.schedule_id = s.id AND ar.biometric_method != 'AUTOMATIC') > 0 as has_manual_attendance,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.schedule_id = s.id AND ar.biometric_method = 'AUTOMATIC') > 0 as has_automatic_attendance
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      JOIN collaborators c ON s.collaborator_id = c.id
      LEFT JOIN cost_centers cc ON s.cost_center_id = cc.id
      LEFT JOIN marking_zones mz ON s.marking_zone_id = mz.id
      WHERE s.company_id = ? AND s.date BETWEEN ? AND ? AND s.onDelete = 0
    `, [companyId, startDate, endDate]);
    return rows;
  }

  async createOrUpdate(data: any, connection: any = pool) {
    const { id, company_id, collaborator_id, shift_id, cost_center_id, marking_zone_id, date } = data;
    
    await connection.execute(`
      INSERT INTO schedules (id, company_id, collaborator_id, shift_id, cost_center_id, marking_zone_id, date, onDelete)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE 
        shift_id = VALUES(shift_id),
        cost_center_id = VALUES(cost_center_id),
        marking_zone_id = VALUES(marking_zone_id),
        onDelete = 0
    `, [id, company_id, collaborator_id, shift_id, cost_center_id || null, marking_zone_id || null, date]);
    
    return id;
  }

  async delete(companyId: string, id: string) {
    await pool.execute('UPDATE schedules SET onDelete = 1 WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  async getParameters(companyId: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM scheduling_parameters WHERE company_id = ? ORDER BY createdAt DESC LIMIT 1',
      [companyId]
    );
    return rows[0] || { min_rest_hours: 12, max_daily_extra_hours: 2, max_weekly_extra_hours: 12 }; // Valores por defecto
  }

  async findById(companyId: string, id: string) {
    const [rows]: any = await pool.execute(`
      SELECT s.*, sh.is_automatic_marking, sh.start_time, sh.end_time, sh.start_time_2, sh.end_time_2, sh.shift_type
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.id = ? AND s.company_id = ? AND s.onDelete = 0
    `, [id, companyId]);
    return rows[0];
  }

  async createParameters(data: { id: string, company_id: string, user_id: string, min_rest_hours: number, max_daily_extra_hours: number, max_weekly_extra_hours: number }) {
    const { id, company_id, user_id, min_rest_hours, max_daily_extra_hours, max_weekly_extra_hours } = data;
    await pool.execute(
      'INSERT INTO scheduling_parameters (id, company_id, user_id, min_rest_hours, max_daily_extra_hours, max_weekly_extra_hours) VALUES (?, ?, ?, ?, ?, ?)',
      [id, company_id, user_id, min_rest_hours, max_daily_extra_hours, max_weekly_extra_hours]
    );
    return id;
  }

  async findByCollaboratorAndDate(companyId: string, collaboratorId: string, date: string) {
    const [rows]: any = await pool.execute(`
      SELECT s.*, sh.start_time, sh.end_time, sh.start_time_2, sh.end_time_2, sh.shift_type, sh.is_automatic_marking
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.company_id = ? AND s.collaborator_id = ? AND DATE(s.date) = DATE(?) AND s.onDelete = 0
    `, [companyId, collaboratorId, date]);
    return rows[0];
  }

  async hasAttendance(id: string, connection: any = pool): Promise<boolean> {
    const [rows]: any = await connection.execute('SELECT COUNT(*) as count FROM attendance_records WHERE schedule_id = ?', [id]);
    return rows[0].count > 0;
  }
}
