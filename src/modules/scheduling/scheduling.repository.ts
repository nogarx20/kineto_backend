
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
        cc.code as cost_center_code,
        c.first_name, 
        c.last_name
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      JOIN collaborators c ON s.collaborator_id = c.id
      LEFT JOIN cost_centers cc ON s.cost_center_id = cc.id
      WHERE s.company_id = ? AND s.date BETWEEN ? AND ?
    `, [companyId, startDate, endDate]);
    return rows;
  }

  async createOrUpdate(data: any) {
    const { id, company_id, collaborator_id, shift_id, cost_center_id, date } = data;
    
    // Upsert logic: Si ya existe programación para ese usuario en esa fecha, actualiza el turno y centro de costo
    await pool.execute(`
      INSERT INTO schedules (id, company_id, collaborator_id, shift_id, cost_center_id, date)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        shift_id = VALUES(shift_id),
        cost_center_id = VALUES(cost_center_id)
    `, [id, company_id, collaborator_id, shift_id, cost_center_id || null, date]);
    
    return id;
  }

  async delete(companyId: string, id: string) {
    await pool.execute('DELETE FROM schedules WHERE id = ? AND company_id = ?', [id, companyId]);
  }
}
