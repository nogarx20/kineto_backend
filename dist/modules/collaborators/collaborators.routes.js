"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collaborators_controller_1 = require("./collaborators.controller");
const auth_middleware_1 = require("../../middlewares/auth.middleware");
const tenant_middleware_1 = require("../../middlewares/tenant.middleware");
const rbac_middleware_1 = require("../../middlewares/rbac.middleware");
const router = (0, express_1.Router)();
const controller = new collaborators_controller_1.CollaboratorController();
router.use(auth_middleware_1.authMiddleware, tenant_middleware_1.tenantMiddleware);
// Collaborators
router.get('/', (0, rbac_middleware_1.rbacMiddleware)('collaborators.read'), controller.list);
router.post('/', (0, rbac_middleware_1.rbacMiddleware)('collaborators.create'), controller.create);
// Auxiliares (Sin RBAC estricto específico para el ejemplo, pero heredan auth)
router.get('/positions', controller.listPositions);
router.post('/positions', controller.createPosition);
router.get('/cost-centers', controller.listCostCenters);
router.post('/cost-centers', controller.createCostCenter);
exports.default = router;
