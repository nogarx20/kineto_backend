"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("./reports.service");
const service = new reports_service_1.ReportsService();
class ReportsController {
    async getStats(req, res) {
        try {
            const user = req.user;
            const stats = await service.getDashboardStats(user.company_id);
            res.json(stats);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.ReportsController = ReportsController;
