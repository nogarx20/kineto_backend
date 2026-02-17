import pool from '../../config/database';

export class AttendanceRepository {
  async createRecord(data: any) {
    const { 
      id, company_id, collaborator_id, schedule_id, type, 
      lat, lng, marking_zone_id, is_valid_zone, status, biometric_method 
    } = data;

    // Aseguramos que ningún parámetro sea undefined para evitar el error del driver mysql2
    const params = [
      id ?? null, 
      company_id ?? null, 
      collaborator_id ?? null, 
      schedule_id ?? null, 
      type ?? null, 
      lat ?? null, 
      lng ?? null, 
      marking_zone_id ?? null, 
      is_valid_zone ? 1 : 0, 
      status ?? 'Unknown', 
      biometric_method || 'FACE'
    ];

    await pool.execute(`
      INSERT INTO attendance_records 
      (id, company_id, collaborator_id, schedule_id, type, lat, lng, marking_zone_id, is_valid_zone, status, biometric_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, params);
    
    return id;
  }

  async findTodayRecords(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(`
      SELECT * FROM attendance_records 
      WHERE company_id = ? AND collaborator_id = ? 
      AND DATE(timestamp) = CURDATE()
      ORDER BY timestamp DESC
    `, [companyId, collaboratorId]);
    return rows;
  }

  async findTodaySchedule(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(`
      SELECT s.*, sh.start_time, sh.end_time, sh.entry_start_buffer, sh.entry_end_buffer, sh.marking_zone_id, sh.name as shift_name
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

  async findCollaboratorByIdAndPin(companyId: string, identification: string, pin: string) {
    const [rows]: any = await pool.execute(`
      SELECT * FROM collaborators WHERE company_id = ? AND identification = ? AND pin = ?
    `, [companyId, identification, pin]);
    return rows[0];
  }

  async findActiveContract(collaboratorId: string, companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT * FROM contracts 
      WHERE collaborator_id = ? AND company_id = ? AND status = 'Activo'
      LIMIT 1
    `, [collaboratorId, companyId]);
    return rows[0];
  }
}
