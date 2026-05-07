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

  async create(data: any) {
    const { id, company_id, collaborator_id, schedule_id, time, type, lat, lng, validation_details, geofence_details, biometric_validation_id, biometric_score } = data;
    await pool.execute(
      `INSERT INTO attendance_records (id, company_id, collaborator_id, schedule_id, timestamp, type, lat, lng, validation_details, geofence_details, biometric_validation_id, biometric_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, company_id, collaborator_id, schedule_id, time, type, lat, lng, validation_details, geofence_details, biometric_validation_id || null, biometric_score || null]
    );
  }

  async findLastMarking(collaboratorId: string, scheduleId?: string) {
    const [rows]: any = await pool.execute(
      `SELECT *, timestamp as time FROM attendance_records WHERE collaborator_id = ? ${scheduleId ? 'AND schedule_id = ?' : ''} ORDER BY timestamp DESC LIMIT 1`,
      scheduleId ? [collaboratorId, scheduleId] : [collaboratorId]
    );
    return rows[0];
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

  async findByScheduleId(companyId: string, scheduleId: string) {
    const [rows]: any = await pool.execute(`
      SELECT
        ar.timestamp as time,
        ar.*,
        cc.name as cost_center_name,
        mz.name as marking_zone_name
      FROM attendance_records ar
      LEFT JOIN schedules s ON ar.schedule_id = s.id
      LEFT JOIN cost_centers cc ON s.cost_center_id = cc.id
      LEFT JOIN marking_zones mz ON s.marking_zone_id = mz.id
      WHERE ar.company_id = ? AND ar.schedule_id = ?
      ORDER BY ar.timestamp ASC
    `, [companyId, scheduleId]);
    return rows;
  }
}
