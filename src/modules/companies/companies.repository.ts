import pool from '../../config/database';

export class CompanyRepository {
  async create(company: any) {
    const { id, name, tax_id, plan, status } = company;
    await pool.execute(
      'INSERT INTO companies (id, name, tax_id, plan, status, onDelete) VALUES (?, ?, ?, ?, ?, 0)',
      [id, name, tax_id, plan, status]
    );
    return id;
  }

  async findById(id: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM companies WHERE id = ? AND onDelete = 0',
      [id]
    );
    return rows[0];
  }

  async findAll() {
    const [rows]: any = await pool.execute(
      'SELECT id, name, tax_id, plan, status, createdAt FROM companies WHERE onDelete = 0'
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

  // Fix: Added update method for general company info to resolve functional requirements of Companies.tsx
  async update(id: string, data: any) {
    await pool.execute(
      'UPDATE companies SET name = ?, tax_id = ?, plan = ?, status = ? WHERE id = ?',
      [data.name, data.tax_id, data.plan, data.status, id]
    );
  }

  // Fix: Added delete method for company to resolve functional requirements of Companies.tsx
  async delete(id: string) {
    await pool.execute('UPDATE companies SET onDelete = 1 WHERE id = ?', [id]);
  }
}
