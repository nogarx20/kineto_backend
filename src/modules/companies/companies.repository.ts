
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

  async findById(id: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM companies WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  async findAll() {
    const [rows]: any = await pool.execute(
      'SELECT id, name, tax_id, plan, status, createdAt FROM companies'
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
