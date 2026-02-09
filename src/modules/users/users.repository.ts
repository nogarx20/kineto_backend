
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
      'SELECT id, company_id, email, first_name, last_name, is_active, is_locked, failed_attempts, createdAt FROM users WHERE company_id = ? AND id = ?',
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
      'SELECT id, email, first_name, last_name, is_active, is_locked, failed_attempts, createdAt FROM users WHERE company_id = ?',
      [companyId]
    );
    return rows;
  }

  async incrementFailedAttempts(userId: string) {
    await pool.execute(
      'UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?',
      [userId]
    );
  }

  async lockAccount(userId: string) {
    await pool.execute(
      'UPDATE users SET is_locked = TRUE, locked_at = NOW() WHERE id = ?',
      [userId]
    );
  }

  async resetAttempts(userId: string) {
    await pool.execute(
      'UPDATE users SET failed_attempts = 0, is_locked = FALSE, locked_at = NULL WHERE id = ?',
      [userId]
    );
  }

  async findGlobalByEmail(email: string) {
    const [rows]: any = await pool.execute(
        'SELECT * FROM users WHERE email = ? LIMIT 1',
        [email]
    );
    return rows[0];
  }
}
