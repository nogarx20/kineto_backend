"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoveltyService = void 0;
const novelties_repository_1 = require("./novelties.repository");
const uuid_1 = require("../../utils/uuid");
class NoveltyService {
    constructor() {
        this.repository = new novelties_repository_1.NoveltyRepository();
    }
    async getNovelties(companyId) {
        return await this.repository.findAll(companyId);
    }
    async createNovelty(companyId, data) {
        const id = (0, uuid_1.generateUUID)();
        const newNovelty = {
            ...data,
            id,
            company_id: companyId,
            status: 'Pending' // Por defecto pendiente de aprobación
        };
        await this.repository.create(newNovelty);
        return id;
    }
    async approveNovelty(id) {
        await this.repository.updateStatus(id, 'Approved');
    }
    async rejectNovelty(id) {
        await this.repository.updateStatus(id, 'Rejected');
    }
}
exports.NoveltyService = NoveltyService;
