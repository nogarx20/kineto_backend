"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingService = void 0;
const scheduling_repository_1 = require("./scheduling.repository");
const uuid_1 = require("../../utils/uuid");
class SchedulingService {
    constructor() {
        this.repository = new scheduling_repository_1.SchedulingRepository();
    }
    async getSchedule(companyId, startDate, endDate) {
        return await this.repository.findByDateRange(companyId, startDate, endDate);
    }
    async assignShift(companyId, collaboratorId, shiftId, date) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.createOrUpdate({
            id,
            company_id: companyId,
            collaborator_id: collaboratorId,
            shift_id: shiftId,
            date
        });
        return { success: true };
    }
    // Asignación masiva (útil para "Pegar" programación)
    async bulkAssign(companyId, assignments) {
        for (const item of assignments) {
            await this.assignShift(companyId, item.collaboratorId, item.shiftId, item.date);
        }
        return { count: assignments.length };
    }
}
exports.SchedulingService = SchedulingService;
