"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulingRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class SchedulingRepository {
    async findByDateRange(companyId, startDate, endDate) {
        const [rows] = await database_1.default.execute(`
      SELECT s.*, sh.name as shift_name, sh.prefix as shift_prefix, 
             sh.start_time, sh.end_time, c.first_name, c.last_name
      FROM schedules s
      JOIN shifts sh ON s.shift_id = sh.id
      JOIN collaborators c ON s.collaborator_id = c.id
      WHERE s.company_id = ? AND s.date BETWEEN ? AND ?
    `, [companyId, startDate, endDate]);
        return rows;
    }
    async createOrUpdate(data) {
        const { id, company_id, collaborator_id, shift_id, date } = data;
        // Upsert logic: Si ya existe programación para ese usuario en esa fecha, actualiza el turno
        await database_1.default.execute(`
      INSERT INTO schedules (id, company_id, collaborator_id, shift_id, date)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE shift_id = VALUES(shift_id)
    `, [id, company_id, collaborator_id, shift_id, date]);
        return id;
    }
    async delete(companyId, id) {
        await database_1.default.execute('DELETE FROM schedules WHERE id = ? AND company_id = ?', [id, companyId]);
    }
}
exports.SchedulingRepository = SchedulingRepository;
