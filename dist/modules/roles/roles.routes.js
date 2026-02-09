"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roles_controller_1 = require("./roles.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const tenant_middleware_1 = require("../../middlewares/tenant.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
const controller = new roles_controller_1.RoleController();
router.use(auth_middleware_1.authMiddleware, tenant_middleware_1.tenantMiddleware);
router.get('/', (0, rbac_middleware_1.rbacMiddleware)('roles.read'), // Asumiendo que existe este permiso
controller.list);
router.post('/', (0, rbac_middleware_1.rbacMiddleware)('roles.create'), controller.create);
router.post('/assign', (0, rbac_middleware_1.rbacMiddleware)('users.update'), controller.assign);
exports.default = router;
