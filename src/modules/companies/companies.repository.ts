import pool from '../../config/database';

export class CompanyRepository {
  async create(company: any) {
    const { id, name, tax_id, plan, status } = company;
    await pool.execute(
      'INSERT INTO companies (id, name, tax_id, plan, status) VALUES (?, ?, ?, ?, ?)',
      [id, name, tax_id, plan, status]
    );
    return id;
  }

  async update(id: string, data: any) {
    const { name, tax_id, plan, status } = data;
    await pool.execute(
      'UPDATE companies SET name = ?, tax_id = ?, plan = ?, status = ? WHERE id = ?',
      [name, tax_id, plan, status, id]
    );
  }

  async delete(id: string) {
    await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
  }

  async findById(id: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM companies WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  async findAll() {
    const [rows]: any = await pool.execute(
      'SELECT id, name, tax_id, plan, status, createdAt FROM companies ORDER BY createdAt DESC'
    );
    return rows;
  }

  async updateStatus(id: string, status: string) {
    await pool.execute(
      'UPDATE companies SET status = ? WHERE id = ?',
      [status, id]
    );
  }

  async updateSettings(id: string, settings: any) {
    await pool.execute(
      'UPDATE companies SET settings = ? WHERE id = ?',
      [JSON.stringify(settings), id]
    );
  }
}