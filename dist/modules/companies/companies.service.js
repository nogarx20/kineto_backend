"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyService = void 0;
const companies_repository_1 = require("./companies.repository");
const uuid_1 = require("../../utils/uuid");
class CompanyService {
    constructor() {
        this.repository = new companies_repository_1.CompanyRepository();
    }
    async createCompany(data) {
        const id = (0, uuid_1.generateUUID)();
        const newCompany = {
            id,
            name: data.name,
            tax_id: data.tax_id,
            plan: data.plan || 'Basic',
            status: 'Active'
        };
        await this.repository.create(newCompany);
        return newCompany;
    }
    async getCompany(id) {
        const company = await this.repository.findById(id);
        if (!company)
            throw new Error('Empresa no encontrada');
        return company;
    }
    async listCompanies() {
        return await this.repository.findAll();
    }
    async updateSettings(id, settings) {
        await this.repository.updateSettings(id, settings);
    }
}
exports.CompanyService = CompanyService;
