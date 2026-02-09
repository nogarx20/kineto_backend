"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShiftRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class ShiftRepository {
    // --- Zones ---
    async findAllZones(companyId) {
        const [rows] = await database_1.default.execute('SELECT * FROM marking_zones WHERE company_id = ?', [companyId]);
        return rows;
    }
    async createZone(data) {
        const { id, company_id, name, lat, lng, radius } = data;
        await database_1.default.execute('INSERT INTO marking_zones (id, company_id, name, lat, lng, radius) VALUES (?, ?, ?, ?, ?, ?)', [id, company_id, name, lat, lng, radius]);
        return id;
    }
    // --- Shifts ---
    async findAllShifts(companyId) {
        const [rows] = await database_1.default.execute(`
      SELECT s.*, z.name as zone_name 
      FROM shifts s
      LEFT JOIN marking_zones z ON s.marking_zone_id = z.id
      WHERE s.company_id = ?
    `, [companyId]);
        return rows;
    }
    async createShift(data) {
        const { id, company_id, name, prefix, start_time, end_time, entry_buffer_minutes, exit_buffer_minutes, marking_zone_id } = data;
        await database_1.default.execute(`
      INSERT INTO shifts 
      (id, company_id, name, prefix, start_time, end_time, entry_buffer_minutes, exit_buffer_minutes, marking_zone_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, name, prefix, start_time, end_time, entry_buffer_minutes, exit_buffer_minutes, marking_zone_id]);
        return id;
    }
}
exports.ShiftRepository = ShiftRepository;
