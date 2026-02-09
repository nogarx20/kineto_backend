"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const users_service_1 = require("./users.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const userService = new users_service_1.UserService();
class UserController {
    async login(req, res) {
        try {
            const { companyId, email, password } = req.body;
            const result = await userService.authenticate(companyId, email, password);
            // Audit login (fake request object since user is not in req yet)
            const fakeReq = { user: { id: result.user.id, company_id: companyId }, ip: req.ip };
            await (0, audit_middleware_1.logAudit)(fakeReq, 'LOGIN', 'users', result.user.id);
            res.json(result);
        }
        catch (err) {
            res.status(401).json({ error: err.message });
        }
    }
    async create(req, res) {
        try {
            // Fix: Cast req to any to access body property which is reported as missing on AuthenticatedRequest
            const data = { ...req.body, company_id: req.user?.company_id };
            const id = await userService.createUser(data);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'users', id, { email: data.email });
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    async list(req, res) {
        try {
            const users = await userService.getUsers(req.user.company_id);
            res.json(users);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.UserController = UserController;
