"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class ReportsRepository {
    async getComplianceStats(companyId) {
        // Retorna datos agregados de cumplimiento por colaborador (simplificado para demo)
        // En producción esto debería filtrar por fecha
        const [rows] = await database_1.default.execute(`
      SELECT 
        c.id, 
        CONCAT(c.first_name, ' ', c.last_name) as name,
        COUNT(DISTINCT s.id) as programado,
        COUNT(DISTINCT a.id) as ejecutado,
        SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count
      FROM collaborators c
      LEFT JOIN schedules s ON c.id = s.collaborator_id AND s.date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND CURDATE()
      LEFT JOIN attendance_records a ON c.id = a.collaborator_id AND a.timestamp BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND NOW()
      WHERE c.company_id = ?
      GROUP BY c.id
      LIMIT 10
    `, [companyId]);
        return rows;
    }
    async getAttendanceDistribution(companyId) {
        const [rows] = await database_1.default.execute(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM attendance_records 
      WHERE company_id = ? AND timestamp >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY status
    `, [companyId]);
        return rows;
    }
}
exports.ReportsRepository = ReportsRepository;
