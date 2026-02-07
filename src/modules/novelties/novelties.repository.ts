
import pool from '../../config/database';

export class NoveltyRepository {
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT n.*, c.first_name, c.last_name, c.identification
      FROM novelties n
      JOIN collaborators c ON n.collaborator_id = c.id
      WHERE n.company_id = ?
      ORDER BY n.created_at DESC
    `, [companyId]);
    return rows;
  }

  async create(data: any) {
    const { id, company_id, collaborator_id, type, start_date, end_date, details, status } = data;
    await pool.execute(`
      INSERT INTO novelties (id, company_id, collaborator_id, type, start_date, end_date, details, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, collaborator_id, type, start_date, end_date, details, status]);
    return id;
  }

  async updateStatus(id: string, status: string) {
    await pool.execute('UPDATE novelties SET status = ? WHERE id = ?', [status, id]);
  }
}
