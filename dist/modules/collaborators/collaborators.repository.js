"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollaboratorRepository = void 0;
const database_1 = __importDefault(require("../../config/database"));
class CollaboratorRepository {
    // --- Collaborators ---
    async findAll(companyId) {
        const [rows] = await database_1.default.execute(`
      SELECT c.*, p.name as position_name, cc.name as cost_center_name 
      FROM collaborators c
      LEFT JOIN positions p ON c.position_id = p.id
      LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
      WHERE c.company_id = ?
    `, [companyId]);
        return rows;
    }
    async findById(companyId, id) {
        const [rows] = await database_1.default.execute('SELECT * FROM collaborators WHERE company_id = ? AND id = ?', [companyId, id]);
        return rows[0];
    }
    async create(data) {
        const { id, company_id, identification, first_name, last_name, email, phone, position_id, cost_center_id } = data;
        await database_1.default.execute(`
      INSERT INTO collaborators 
      (id, company_id, identification, first_name, last_name, email, phone, position_id, cost_center_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, identification, first_name, last_name, email, phone, position_id, cost_center_id]);
        return id;
    }
    // --- Auxiliaries (Positions & Cost Centers) ---
    async createPosition(data) {
        await database_1.default.execute('INSERT INTO positions (id, company_id, name) VALUES (?, ?, ?)', [data.id, data.company_id, data.name]);
    }
    async listPositions(companyId) {
        const [rows] = await database_1.default.execute('SELECT * FROM positions WHERE company_id = ?', [companyId]);
        return rows;
    }
    async createCostCenter(data) {
        await database_1.default.execute('INSERT INTO cost_centers (id, company_id, code, name) VALUES (?, ?, ?, ?)', [data.id, data.company_id, data.code, data.name]);
    }
    async listCostCenters(companyId) {
        const [rows] = await database_1.default.execute('SELECT * FROM cost_centers WHERE company_id = ?', [companyId]);
        return rows;
    }
}
exports.CollaboratorRepository = CollaboratorRepository;
