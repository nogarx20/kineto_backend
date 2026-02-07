
import pool from '../../config/database';

export class AttendanceRepository {
  async createRecord(data: any) {
    const { 
      id, company_id, collaborator_id, schedule_id, type, 
      lat, lng, marking_zone_id, is_valid_zone, status 
    } = data;

    await pool.execute(`
      INSERT INTO attendance_records 
      (id, company_id, collaborator_id, schedule_id, type, lat, lng, marking_zone_id, is_valid_zone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, collaborator_id, schedule_id, type, lat, lng, marking_zone_id, is_valid_zone, status]);
    
    return id;
  }

  // Buscar marcajes recientes (hoy)
  async findTodayRecords(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(`
      SELECT * FROM attendance_records 
      WHERE company_id = ? AND collaborator_id = ? 
      AND DATE(timestamp) = CURDATE()
      ORDER BY timestamp DESC
    `, [companyId, collaboratorId]);
    return rows;
  }

  // Buscar turno programado para hoy para un colaborador
  async findTodaySchedule(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(`
      SELECT s.*, sh.start_time, sh.end_time, sh.entry_buffer_minutes, sh.marking_zone_id
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      WHERE s.company_id = ? AND s.collaborator_id = ? AND s.date = CURDATE()
    `, [companyId, collaboratorId]);
    return rows[0];
  }

  async findCollaboratorByIdentification(companyId: string, identification: string) {
    const [rows]: any = await pool.execute(`
      SELECT * FROM collaborators WHERE company_id = ? AND identification = ?
    `, [companyId, identification]);
    return rows[0];
  }
}
