import pool from '../../config/database';

export class NoveltyRepository {
  // --- Tipos de Novedades ---
  async findAllTypes(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT nt.*, 
      (SELECT COUNT(*) FROM novelties n WHERE n.novelty_type_id = nt.id AND n.onDelete = 0) as request_count,
      (SELECT COUNT(*) FROM novelties n WHERE n.novelty_type_id = nt.id AND n.onDelete = 0 
       AND CURDATE() BETWEEN DATE(n.start_date) AND DATE(n.end_date)) as active_request_count
      FROM novelty_types nt 
      WHERE nt.company_id = ? AND nt.onDelete = 0 
      ORDER BY nt.name ASC
    `, [companyId]);
    return rows;
  }

  async createType(data: any) {
    const { id, company_id, name, prefix, period, type, generates_man_hours, is_active } = data;
    await pool.execute(
      'INSERT INTO novelty_types (id, company_id, name, prefix, period, type, generates_man_hours, is_active, onDelete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)',
      [id, company_id, name, prefix, period, type, generates_man_hours ? 1 : 0, is_active === undefined ? 1 : (is_active ? 1 : 0)]
    );
    return id;
  }

  async updateType(id: string, companyId: string, data: any) {
    const { name, prefix, period, type, generates_man_hours, is_active } = data;
    await pool.execute(
      'UPDATE novelty_types SET name = ?, prefix = ?, period = ?, type = ?, generates_man_hours = ?, is_active = ? WHERE id = ? AND company_id = ?',
      [name, prefix, period, type, generates_man_hours ? 1 : 0, is_active ? 1 : 0, id, companyId]
    );
  }

  async deleteType(id: string, companyId: string) {
    await pool.execute('UPDATE novelty_types SET onDelete = 1 WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Solicitudes de Novedades ---
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT n.*, c.first_name, c.last_name, c.identification, nt.name as novelty_type_name, nt.period as novelty_period, nt.prefix as novelty_prefix
      FROM novelties n
      JOIN collaborators c ON n.collaborator_id = c.id
      JOIN novelty_types nt ON n.novelty_type_id = nt.id
      WHERE n.company_id = ? AND n.onDelete = 0
      ORDER BY n.created_at DESC
    `, [companyId]);
    return rows;
  }

  async create(data: any) {
    const { id, company_id, collaborator_id, novelty_type_id, start_date, end_date, start_time, end_time, details, support_file_url, status } = data;
    await pool.execute(`
      INSERT INTO novelties (id, company_id, collaborator_id, novelty_type_id, start_date, end_date, start_time, end_time, details, support_file_url, status, onDelete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, company_id, collaborator_id, novelty_type_id, start_date, end_date, start_time || null, end_time || null, details, support_file_url || null, status]);
    return id;
  }

  async update(id: string, companyId: string, data: any) {
    const { collaborator_id, novelty_type_id, start_date, end_date, start_time, end_time, details, support_file_url } = data;
    await pool.execute(`
      UPDATE novelties 
      SET collaborator_id = ?, novelty_type_id = ?, start_date = ?, end_date = ?, start_time = ?, end_time = ?, details = ?, support_file_url = ?
      WHERE id = ? AND company_id = ?
    `, [collaborator_id, novelty_type_id, start_date, end_date, start_time || null, end_time || null, details, support_file_url || null, id, companyId]);
  }

  async updateStatus(id: string, status: string, reason?: string) {
    await pool.execute('UPDATE novelties SET status = ?, rejection_reason = ? WHERE id = ?', [status, reason || null, id]);
  }

  async delete(id: string, companyId: string) {
    await pool.execute('UPDATE novelties SET onDelete = 1 WHERE id = ? AND company_id = ?', [id, companyId]);
  }
}
