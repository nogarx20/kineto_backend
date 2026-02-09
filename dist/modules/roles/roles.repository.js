"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class RoleRepository {
    async findAll(companyId) {
        const [rows] = await database_1.default.execute('SELECT * FROM roles WHERE company_id = ?', [companyId]);
        return rows;
    }
    async create(role) {
        const { id, company_id, name } = role;
        await database_1.default.execute('INSERT INTO roles (id, company_id, name) VALUES (?, ?, ?)', [id, company_id, name]);
        return id;
    }
    async assignPermission(roleId, permissionCode) {
        // Primero obtener ID del permiso
        const [perms] = await database_1.default.execute('SELECT id FROM permissions WHERE code = ?', [permissionCode]);
        if (perms.length === 0)
            return;
        await database_1.default.execute('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, perms[0].id]);
    }
    async assignUserRole(userId, roleId) {
        await database_1.default.execute('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
    }
}
exports.RoleRepository = RoleRepository;
