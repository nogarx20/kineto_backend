
import pool from '../../config/database';

export class ShiftRepository {
  
  // --- Zones ---
  async findAllZones(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM marking_zones WHERE company_id = ?', [companyId]);
    return rows;
  }

  async createZone(data: any) {
    const { id, company_id, name, lat, lng, radius } = data;
    await pool.execute(
      'INSERT INTO marking_zones (id, company_id, name, lat, lng, radius) VALUES (?, ?, ?, ?, ?, ?)',
      [id, company_id, name, lat, lng, radius]
    );
    return id;
  }

  // --- Shifts ---
  async findAllShifts(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT s.*, z.name as zone_name 
      FROM shifts s
      LEFT JOIN marking_zones z ON s.marking_zone_id = z.id
      WHERE s.company_id = ?
    `, [companyId]);
    return rows;
  }

  async createShift(data: any) {
    const { 
      id, company_id, name, prefix, start_time, end_time, 
      entry_buffer_minutes, exit_buffer_minutes, marking_zone_id 
    } = data;
    
    await pool.execute(`
      INSERT INTO shifts 
      (id, company_id, name, prefix, start_time, end_time, entry_buffer_minutes, exit_buffer_minutes, marking_zone_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, name, prefix, start_time, end_time, entry_buffer_minutes, exit_buffer_minutes, marking_zone_id]);
    
    return id;
  }
}
