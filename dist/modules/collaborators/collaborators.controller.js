"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaboratorController = void 0;
const collaborators_service_1 = require("./collaborators.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const service = new collaborators_service_1.CollaboratorService();
class CollaboratorController {
    // --- Colaboradores ---
    async list(req, res) {
        try {
            const user = req.user;
            const data = await service.getCollaborators(user.company_id);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async create(req, res) {
        try {
            const user = req.user;
            const body = req.body;
            const id = await service.createCollaborator(user.company_id, body);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'collaborators', id, { identification: body.identification });
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    // --- Cargos ---
    async listPositions(req, res) {
        try {
            const user = req.user;
            const data = await service.getPositions(user.company_id);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async createPosition(req, res) {
        try {
            const user = req.user;
            const { name } = req.body;
            const id = await service.createPosition(user.company_id, name);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    // --- Centros de Costo ---
    async listCostCenters(req, res) {
        try {
            const user = req.user;
            const data = await service.getCostCenters(user.company_id);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async createCostCenter(req, res) {
        try {
            const user = req.user;
            const { code, name } = req.body;
            const id = await service.createCostCenter(user.company_id, code, name);
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.CollaboratorController = CollaboratorController;
