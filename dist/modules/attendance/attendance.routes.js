"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_1 = require("./attendance.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const tenant_middleware_1 = require("../../middlewares/tenant.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
const controller = new attendance_controller_1.AttendanceController();
router.use(auth_middleware_1.authMiddleware, tenant_middleware_1.tenantMiddleware);
// Endpoint para realizar marcaje
router.post('/mark', (0, rbac_middleware_1.rbacMiddleware)('attendance.create'), controller.mark);
exports.default = router;
