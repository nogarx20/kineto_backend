"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantMiddleware = void 0;
const tenantMiddleware = (req, res, next) => {
    if (!req.user || !req.user.company_id) {
        return res.status(400).json({ error: 'Contexto de empresa no encontrado' });
    }
    next();
};
exports.tenantMiddleware = tenantMiddleware;
