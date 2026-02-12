
import pool from '../../config/database';

export class NoveltyRepository {
  // --- Tipos de Novedades ---
  async findAllTypes(companyId: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM novelty_types WHERE company_id = ? ORDER BY createdAt DESC',
      [companyId]
    );
    return rows;
  }

  async createType(data: any) {
    const { id, company_id, name, prefix, period, type, generates_man_hours } = data;
    await pool.execute(
      'INSERT INTO novelty_types (id, company_id, name, prefix, period, type, generates_man_hours) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, company_id, name, prefix, period, type, generates_man_hours ? 1 : 0]
    );
    return id;
  }

  async updateType(id: string, companyId: string, data: any) {
    const { name, prefix, period, type, generates_man_hours } = data;
    await pool.execute(
      'UPDATE novelty_types SET name = ?, prefix = ?, period = ?, type = ?, generates_man_hours = ? WHERE id = ? AND company_id = ?',
      [name, prefix, period, type, generates_man_hours ? 1 : 0, id, companyId]
    );
  }

  async deleteType(id: string, companyId: string) {
    await pool.execute('DELETE FROM novelty_types WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Solicitudes de Novedades ---
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT n.*, c.first_name, c.last_name, c.identification, nt.name as novelty_type_name, nt.period as novelty_period, nt.prefix as novelty_prefix
      FROM novelties n
      JOIN collaborators c ON n.collaborator_id = c.id
      JOIN novelty_types nt ON n.novelty_type_id = nt.id
      WHERE n.company_id = ?
      ORDER BY n.created_at DESC
    `, [companyId]);
    return rows;
  }

  async create(data: any) {
    const { id, company_id, collaborator_id, novelty_type_id, start_date, end_date, start_time, end_time, details, support_file_url, status } = data;
    await pool.execute(`
      INSERT INTO novelties (id, company_id, collaborator_id, novelty_type_id, start_date, end_date, start_time, end_time, details, support_file_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  async updateStatus(id: string, status: string) {
    await pool.execute('UPDATE novelties SET status = ? WHERE id = ?', [status, id]);
  }

  async delete(id: string, companyId: string) {
    await pool.execute('DELETE FROM novelties WHERE id = ? AND company_id = ?', [id, companyId]);
  }
}
