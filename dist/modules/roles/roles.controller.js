"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleController = void 0;
const roles_service_1 = require("./roles.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const roleService = new roles_service_1.RoleService();
class RoleController {
    async list(req, res) {
        try {
            const user = req.user;
            const roles = await roleService.listRoles(user.company_id);
            res.json(roles);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async create(req, res) {
        try {
            const { name, permissions } = req.body; // permissions es array de strings (códigos)
            const user = req.user;
            const id = await roleService.createRole(user.company_id, name, permissions);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'roles', id, { name, permissions });
            res.status(201).json({ id, name });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    async assign(req, res) {
        try {
            const { userId, roleId } = req.body;
            await roleService.assignRoleToUser(userId, roleId);
            await (0, audit_middleware_1.logAudit)(req, 'ASSIGN_ROLE', 'users', userId, { roleId });
            res.json({ success: true });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.RoleController = RoleController;
