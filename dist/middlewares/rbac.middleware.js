"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacMiddleware = void 0;
const database_1 = __importDefault(require("../config/database"));
const rbacMiddleware = (permissionCode) => {
    return async (req, res, next) => {
        try {
            const [rows] = await database_1.default.execute(`
        SELECT p.code 
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = ? AND p.code = ?
      `, [req.user?.id, permissionCode]);
            if (rows.length === 0) {
                return res.status(403).json({ error: 'Permisos insuficientes' });
            }
            next();
        }
        catch (err) {
            res.status(500).json({ error: 'Error verificando permisos' });
        }
    };
};
exports.rbacMiddleware = rbacMiddleware;
