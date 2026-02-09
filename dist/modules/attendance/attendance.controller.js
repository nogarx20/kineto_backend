"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const attendance_service_1 = require("./attendance.service");
const service = new attendance_service_1.AttendanceService();
class AttendanceController {
    async mark(req, res) {
        try {
            // Este endpoint puede ser llamado por un usuario autenticado (app móvil) 
            // o un kiosco (con token de empresa). Asumimos tenantMiddleware ya extrajo user o context.
            const user = req.user;
            const { identification, lat, lng } = req.body;
            if (!identification) {
                return res.status(400).json({ error: 'Identificación requerida' });
            }
            const result = await service.registerMarking(user.company_id, identification, lat, lng);
            res.json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.AttendanceController = AttendanceController;
