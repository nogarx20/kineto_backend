"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const shifts_controller_1 = require("./shifts.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const tenant_middleware_1 = require("../../middlewares/tenant.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
const controller = new shifts_controller_1.ShiftController();
router.use(auth_middleware_1.authMiddleware, tenant_middleware_1.tenantMiddleware);
// Utiliza el permiso 'shifts.manage' definido en el seed data
router.get('/zones', (0, rbac_middleware_1.rbacMiddleware)('shifts.manage'), controller.listZones);
router.post('/zones', (0, rbac_middleware_1.rbacMiddleware)('shifts.manage'), controller.createZone);
router.get('/', (0, rbac_middleware_1.rbacMiddleware)('shifts.manage'), controller.listShifts);
router.post('/', (0, rbac_middleware_1.rbacMiddleware)('shifts.manage'), controller.createShift);
exports.default = router;
