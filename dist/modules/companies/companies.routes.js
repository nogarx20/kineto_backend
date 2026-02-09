"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const companies_controller_1 = require("./companies.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
const controller = new companies_controller_1.CompanyController();
// Ruta pública para registro
router.post('/', controller.create);
// Rutas protegidas
router.get('/', auth_middleware_1.authMiddleware, controller.list);
router.get('/me', auth_middleware_1.authMiddleware, controller.getMe);
router.patch('/me/settings', auth_middleware_1.authMiddleware, (0, rbac_middleware_1.rbacMiddleware)('settings.manage'), controller.updateSettings);
exports.default = router;
