"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoveltyRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class NoveltyRepository {
    async findAll(companyId) {
        const [rows] = await database_1.default.execute(`
      SELECT n.*, c.first_name, c.last_name, c.identification
      FROM novelties n
      JOIN collaborators c ON n.collaborator_id = c.id
      WHERE n.company_id = ?
      ORDER BY n.created_at DESC
    `, [companyId]);
        return rows;
    }
    async create(data) {
        const { id, company_id, collaborator_id, type, start_date, end_date, details, status } = data;
        await database_1.default.execute(`
      INSERT INTO novelties (id, company_id, collaborator_id, type, start_date, end_date, details, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, collaborator_id, type, start_date, end_date, details, status]);
        return id;
    }
    async updateStatus(id, status) {
        await database_1.default.execute('UPDATE novelties SET status = ? WHERE id = ?', [status, id]);
    }
}
exports.NoveltyRepository = NoveltyRepository;
