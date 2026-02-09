"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftController = void 0;
const shifts_service_1 = require("./shifts.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const service = new shifts_service_1.ShiftService();
class ShiftController {
    // Zones
    async listZones(req, res) {
        try {
            const user = req.user;
            const data = await service.getZones(user.company_id);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async createZone(req, res) {
        try {
            const user = req.user;
            const body = req.body;
            const id = await service.createZone(user.company_id, body);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'marking_zones', id, { name: body.name });
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    // Shifts
    async listShifts(req, res) {
        try {
            const user = req.user;
            const data = await service.getShifts(user.company_id);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async createShift(req, res) {
        try {
            const user = req.user;
            const body = req.body;
            const id = await service.createShift(user.company_id, body);
            await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'shifts', id, { name: body.name });
            res.status(201).json({ id });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.ShiftController = ShiftController;
