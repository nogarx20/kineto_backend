
import pool from '../../config/database';

export class UserRepository {
  async findByEmail(companyId: string, email: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM users WHERE company_id = ? AND email = ?',
      [companyId, email]
    );
    return rows[0];
  }

  async findAllByEmailGlobal(email: string) {
    const [rows]: any = await pool.execute(
      `SELECT u.*, c.name as company_name 
       FROM users u 
       JOIN companies c ON u.company_id = c.id 
       WHERE u.email = ?`,
      [email]
    );
    return rows;
  }

  async findById(companyId: string, id: string) {
    const [rows]: any = await pool.execute(
      'SELECT id, company_id, email, first_name, last_name, is_active, createdAt FROM users WHERE company_id = ? AND id = ?',
      [companyId, id]
    );
    return rows[0];
  }

  async create(user: any) {
    const { id, company_id, email, password, first_name, last_name } = user;
    await pool.execute(
      'INSERT INTO users (id, company_id, email, password, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)',
      [id, company_id, email, password, first_name, last_name]
    );
    return id;
  }

  async listByCompany(companyId: string) {
    const [rows]: any = await pool.execute(
      'SELECT id, email, first_name, last_name, is_active, createdAt FROM users WHERE company_id = ?',
      [companyId]
    );
    return rows;
  }
}
