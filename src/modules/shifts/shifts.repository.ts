import pool from '../../config/database';

export class ShiftRepository {
  
  // --- Zones ---
  async findAllZones(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM marking_zones WHERE company_id = ?', [companyId]);
    return rows;
  }

  async createZone(data: any) {
    const { id, company_id, name, lat, lng, radius, zone_type, bounds } = data;
    await pool.execute(
      'INSERT INTO marking_zones (id, company_id, name, lat, lng, radius, zone_type, bounds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, company_id, name, lat, lng, radius, zone_type || 'circle', bounds ? JSON.stringify(bounds) : null]
    );
    return id;
  }

  // --- Shifts ---
  async findAllShifts(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        s.*, 
        z.name as zone_name,
        (SELECT COUNT(*) FROM schedules sch WHERE sch.shift_id = s.id) as schedule_count
      FROM shifts s
      LEFT JOIN marking_zones z ON s.marking_zone_id = z.id
      WHERE s.company_id = ?
    `, [companyId]);
    return rows;
  }

  async createShift(data: any) {
    const { 
      id, company_id, name, prefix, shift_type,
      start_time, end_time, start_time_2, end_time_2,
      entry_start_buffer, entry_end_buffer, exit_start_buffer, exit_end_buffer,
      entry_start_buffer_2, entry_end_buffer_2, exit_start_buffer_2, exit_end_buffer_2,
      rounding, lunch_start, lunch_end, marking_zone_id, is_active,
      is_automatic_marking, marking_zones_json
    } = data;
    
    await pool.execute(`
      INSERT INTO shifts 
      (id, company_id, name, prefix, shift_type, 
       start_time, end_time, start_time_2, end_time_2,
       entry_start_buffer, entry_end_buffer, exit_start_buffer, exit_end_buffer,
       entry_start_buffer_2, entry_end_buffer_2, exit_start_buffer_2, exit_end_buffer_2,
       rounding, lunch_start, lunch_end, marking_zone_id, is_active, 
       is_automatic_marking, marking_zones_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, company_id, name, prefix, shift_type || 'Simple',
      start_time, end_time, start_time_2 || null, end_time_2 || null,
      entry_start_buffer || 15, entry_end_buffer || 15, exit_start_buffer || 15, exit_end_buffer || 15,
      entry_start_buffer_2 || 15, entry_end_buffer_2 || 15, exit_start_buffer_2 || 15, exit_end_buffer_2 || 15,
      rounding || 0, lunch_start || null, lunch_end || null, marking_zone_id || null, 
      is_active === undefined ? 1 : (is_active ? 1 : 0),
      is_automatic_marking ? 1 : 0,
      marking_zones_json ? JSON.stringify(marking_zones_json) : null
    ]);
    
    return id;
  }
}
