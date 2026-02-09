"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyController = void 0;
const companies_service_1 = require("./companies.service");
const audit_middleware_1 = require("../../middlewares/audit.middleware");
const companyService = new companies_service_1.CompanyService();
class CompanyController {
    async create(req, res) {
        try {
            const body = req.body;
            const company = await companyService.createCompany(body);
            if (req.user) {
                await (0, audit_middleware_1.logAudit)(req, 'CREATE', 'companies', company.id, { name: company.name });
            }
            res.status(201).json(company);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
    async list(req, res) {
        try {
            const companies = await companyService.listCompanies();
            res.json(companies);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
    async getMe(req, res) {
        try {
            const user = req.user;
            const company = await companyService.getCompany(user.company_id);
            res.json(company);
        }
        catch (err) {
            res.status(404).json({ error: err.message });
        }
    }
    async updateSettings(req, res) {
        try {
            const user = req.user;
            const settings = req.body;
            await companyService.updateSettings(user.company_id, settings);
            await (0, audit_middleware_1.logAudit)(req, 'UPDATE_SETTINGS', 'companies', user.company_id, settings);
            res.json({ success: true });
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    }
}
exports.CompanyController = CompanyController;
