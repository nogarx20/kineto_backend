"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAudit = void 0;
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("../utils/uuid");
const logAudit = async (req, action, entity, entityId, details) => {
    try {
        const id = (0, uuid_1.generateUUID)();
        await database_1.default.execute(`
      INSERT INTO system_logs (id, company_id, user_id, action, entity, entity_id, ip_address, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            id,
            req.user?.company_id,
            req.user?.id,
            action,
            entity,
            entityId || null,
            // Fix: Cast req to any to access ip property which is reported as missing on AuthenticatedRequest
            req.ip,
            details ? JSON.stringify(details) : null
        ]);
    }
    catch (err) {
        console.error('Audit Log Error:', err);
    }
};
exports.logAudit = logAudit;
