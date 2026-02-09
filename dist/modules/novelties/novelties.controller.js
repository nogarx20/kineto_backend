"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoveltyController = void 0;
const novelties_service_1 = require("./novelties.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const service = new novelties_service_1.NoveltyService();
class NoveltyController {
    async list(req, res) {
        try {
            const user = req.user;
            const data = await service.getNovelties(user.company_id);
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
            const id = await service.createNovelty(user.company_id, body);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'novelties', id, { type: body.type });
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body; // 'Approved' | 'Rejected'
            if (status === 'Approved')
                await service.approveNovelty(id);
            else if (status === 'Rejected')
                await service.rejectNovelty(id);
            else
                throw new Error('Estado inválido');
            await (0, audit_middleware_1.logAudit)(req, 'UPDATE_STATUS', 'novelties', id, { status });
            res.json({ success: true });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.NoveltyController = NoveltyController;
