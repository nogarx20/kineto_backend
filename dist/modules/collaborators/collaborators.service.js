"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaboratorService = void 0;
const collaborators_repository_1 = require("./collaborators.repository");
const uuid_1 = require("../../utils/uuid");
class CollaboratorService {
    constructor() {
        this.repository = new collaborators_repository_1.CollaboratorRepository();
    }
    async getCollaborators(companyId) {
        return await this.repository.findAll(companyId);
    }
    async createCollaborator(companyId, data) {
        // Validar si existe identificación (TODO: Implementar check en repositorio si es necesario, 
        // pero la DB ya tiene restricción UNIQUE)
        const id = (0, uuid_1.generateUUID)();
        const newCollaborator = {
            ...data,
            id,
            company_id: companyId
        };
        await this.repository.create(newCollaborator);
        return id;
    }
    // Auxiliares
    async createPosition(companyId, name) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.createPosition({ id, company_id: companyId, name });
        return id;
    }
    async getPositions(companyId) {
        return await this.repository.listPositions(companyId);
    }
    async createCostCenter(companyId, code, name) {
        const id = (0, uuid_1.generateUUID)();
        await this.repository.createCostCenter({ id, company_id: companyId, code, name });
        return id;
    }
    async getCostCenters(companyId) {
        return await this.repository.listCostCenters(companyId);
    }
}
exports.CollaboratorService = CollaboratorService;
