"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class CompanyRepository {
    async create(company) {
        const { id, name, tax_id, plan, status } = company;
        await database_1.default.execute('INSERT INTO companies (id, name, tax_id, plan, status) VALUES (?, ?, ?, ?, ?)', [id, name, tax_id, plan, status]);
        return id;
    }
    async findById(id) {
        const [rows] = await database_1.default.execute('SELECT * FROM companies WHERE id = ?', [id]);
        return rows[0];
    }
    async findAll() {
        const [rows] = await database_1.default.execute('SELECT id, name, tax_id, plan, status, createdAt FROM companies');
        return rows;
    }
    async updateStatus(id, status) {
        await database_1.default.execute('UPDATE companies SET status = ? WHERE id = ?', [status, id]);
    }
    async updateSettings(id, settings) {
        await database_1.default.execute('UPDATE companies SET settings = ? WHERE id = ?', [JSON.stringify(settings), id]);
    }
}
exports.CompanyRepository = CompanyRepository;
