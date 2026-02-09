"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingController = void 0;
const scheduling_service_1 = require("./scheduling.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const service = new scheduling_service_1.SchedulingService();
class SchedulingController {
    async getWeekly(req, res) {
        try {
            const user = req.user;
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Fechas requeridas' });
            }
            const data = await service.getSchedule(user.company_id, startDate, endDate);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async assign(req, res) {
        try {
            const user = req.user;
            const { collaboratorId, shiftId, date } = req.body;
            await service.assignShift(user.company_id, collaboratorId, shiftId, date);
            await (0, audit_middleware_1.logAudit)(req, 'ASSIGN_SHIFT', 'schedules', undefined, { collaboratorId, date });
            res.json({ success: true });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    async bulkAssign(req, res) {
        try {
            const user = req.user;
            const { assignments } = req.body; // Array de objetos
            const result = await service.bulkAssign(user.company_id, assignments);
            await (0, audit_middleware_1.logAudit)(req, 'BULK_ASSIGN', 'schedules', undefined, { count: result.count });
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.SchedulingController = SchedulingController;
