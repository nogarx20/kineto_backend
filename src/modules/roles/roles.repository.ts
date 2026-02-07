
import pool from '../../config/database';

export class RoleRepository {
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM roles WHERE company_id = ?',
      [companyId]
    );
    return rows;
  }

  async create(role: any) {
    const { id, company_id, name } = role;
    await pool.execute(
      'INSERT INTO roles (id, company_id, name) VALUES (?, ?, ?)',
      [id, company_id, name]
    );
    return id;
  }

  async assignPermission(roleId: string, permissionCode: string) {
    // Primero obtener ID del permiso
    const [perms]: any = await pool.execute('SELECT id FROM permissions WHERE code = ?', [permissionCode]);
    if (perms.length === 0) return;

    await pool.execute(
      'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
      [roleId, perms[0].id]
    );
  }

  async assignUserRole(userId: string, roleId: string) {
    await pool.execute(
      'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
      [userId, roleId]
    );
  }
}
