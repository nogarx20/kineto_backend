"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const roles_repository_1 = require("./roles.repository");
const uuid_1 = require("../../utils/uuid");
class RoleService {
    constructor() {
        this.repository = new roles_repository_1.RoleRepository();
    }
    async listRoles(companyId) {
        return await this.repository.findAll(companyId);
    }
    async createRole(companyId, name, permissions) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.create({ id, company_id: companyId, name });
        // Asignar permisos
        if (permissions && permissions.length > 0) {
            for (const code of permissions) {
                await this.repository.assignPermission(id, code);
            }
        }
        return id;
    }
    async assignRoleToUser(userId, roleId) {
        await this.repository.assignUserRole(userId, roleId);
    }
}
exports.RoleService = RoleService;
