
import { RoleRepository } from './roles.repository';
import { generateUUID } from '../../utils/uuid';

export class RoleService {
  private repository = new RoleRepository();

  async listRoles(companyId: string) {
    return await this.repository.findAll(companyId);
  }

  async createRole(companyId: string, name: string, permissions: string[]) {
    const id = generateUUID();
    await this.repository.create({ id, company_id: companyId, name });

    // Asignar permisos
    if (permissions && permissions.length > 0) {
      for (const code of permissions) {
        await this.repository.assignPermission(id, code);
      }
    }
    return id;
  }

  async assignRoleToUser(userId: string, roleId: string) {
    await this.repository.assignUserRole(userId, roleId);
  }
}
