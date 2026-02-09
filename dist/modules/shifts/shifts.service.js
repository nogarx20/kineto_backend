"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftService = void 0;
const shifts_repository_1 = require("./shifts.repository");
const uuid_1 = require("../../utils/uuid");
class ShiftService {
    constructor() {
        this.repository = new shifts_repository_1.ShiftRepository();
    }
    // Zones
    async getZones(companyId) {
        return await this.repository.findAllZones(companyId);
    }
    async createZone(companyId, data) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.createZone({ ...data, id, company_id: companyId });
        return id;
    }
    // Shifts
    async getShifts(companyId) {
        return await this.repository.findAllShifts(companyId);
    }
    async createShift(companyId, data) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.createShift({ ...data, id, company_id: companyId });
        return id;
    }
}
exports.ShiftService = ShiftService;
