"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class UserRepository {
    async findByEmail(companyId, email) {
        const [rows] = await database_1.default.execute('SELECT * FROM users WHERE company_id = ? AND email = ?', [companyId, email]);
        return rows[0];
    }
    async findById(companyId, id) {
        const [rows] = await database_1.default.execute('SELECT id, company_id, email, first_name, last_name, is_active, createdAt FROM users WHERE company_id = ? AND id = ?', [companyId, id]);
        return rows[0];
    }
    async create(user) {
        const { id, company_id, email, password, first_name, last_name } = user;
        await database_1.default.execute('INSERT INTO users (id, company_id, email, password, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?)', [id, company_id, email, password, first_name, last_name]);
        return id;
    }
    async listByCompany(companyId) {
        const [rows] = await database_1.default.execute('SELECT id, email, first_name, last_name, is_active, createdAt FROM users WHERE company_id = ?', [companyId]);
        return rows;
    }
}
exports.UserRepository = UserRepository;
