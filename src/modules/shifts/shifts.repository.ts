import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

export class ShiftRepository {
  
  // --- Zones ---
  async findAllZones(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT mz.*, 
      (SELECT COUNT(*) FROM shift_marking_zones smz JOIN shifts s ON smz.shift_id = s.id WHERE smz.marking_zone_id = mz.id AND s.onDelete = 0) as shift_links,
      (SELECT COUNT(*) FROM attendance_records ar WHERE ar.marking_zone_id = mz.id) as attendance_links
      FROM marking_zones mz 
      WHERE mz.company_id = ? AND mz.onDelete = 0
    `, [companyId]);
    return rows;
  }

  async createZone(data: any) {
    const { id, company_id, name, lat, lng, radius, zone_type, bounds, is_active } = data;
    await pool.execute(
      'INSERT INTO marking_zones (id, company_id, name, lat, lng, radius, zone_type, bounds, is_active, onDelete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [id, company_id, name, lat, lng, radius, zone_type || 'circle', bounds ? JSON.stringify(bounds) : null, is_active === undefined ? 1 : (is_active ? 1 : 0)]
    );
    return id;
  }

  // --- Shifts ---
  async findAllShifts(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        s.*, 
        (SELECT JSON_ARRAYAGG(marking_zone_id) 
         FROM shift_marking_zones 
         WHERE shift_id = s.id) as marking_zones_json,
        (SELECT COUNT(*) FROM schedules sch WHERE sch.shift_id = s.id AND sch.onDelete = 0) as schedule_count,
        (SELECT COUNT(*) FROM schedules sch WHERE sch.shift_id = s.id AND sch.onDelete = 0 AND sch.date >= CURDATE()) as active_schedule_count
      FROM shifts s
      WHERE s.company_id = ? AND s.onDelete = 0
    `, [companyId]);
    return rows;
  }

  async createShift(data: any) {
    const { id, company_id, name, prefix, shift_type,
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
       is_automatic_marking, marking_zones_json, onDelete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, company_id, name, prefix, shift_type, start_time, end_time, start_time_2, end_time_2, entry_start_buffer, entry_end_buffer, exit_start_buffer, exit_end_buffer, entry_start_buffer_2, entry_end_buffer_2, exit_start_buffer_2, exit_end_buffer_2, rounding, lunch_start, lunch_end, null, is_active, is_automatic_marking, null]);

    // Insertar relaciones en la nueva tabla
    if (Array.isArray(marking_zones_json) && marking_zones_json.length > 0) {
        const values = marking_zones_json.map(zoneId => [generateUUID(), id, zoneId]);
        await pool.query('INSERT INTO shift_marking_zones (id, shift_id, marking_zone_id) VALUES ?', [values]);
    }
    
    return id;
  }
}
