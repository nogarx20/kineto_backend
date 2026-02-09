"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const users_repository_1 = require("./users.repository");
const password_1 = require("../../utils/password");
const uuid_1 = require("../../utils/uuid");
const jwt_1 = require("../../utils/jwt");
class UserService {
    constructor() {
        this.repository = new users_repository_1.UserRepository();
    }
    async authenticate(companyId, email, pass) {
        const user = await this.repository.findByEmail(companyId, email);
        if (!user || !user.is_active)
            throw new Error('Credenciales inválidas');
        const isValid = await (0, password_1.comparePassword)(pass, user.password);
        if (!isValid)
            throw new Error('Credenciales inválidas');
        const token = (0, jwt_1.generateToken)({
            id: user.id,
            company_id: user.company_id,
            email: user.email
        });
        return { token, user: { id: user.id, firstName: user.first_name, lastName: user.last_name } };
    }
    async createUser(data) {
        const existing = await this.repository.findByEmail(data.company_id, data.email);
        if (existing)
            throw new Error('Email ya registrado en esta empresa');
        const hashedPassword = await (0, password_1.hashPassword)(data.password);
        const id = (0, uuid_1.generateUUID)();
        const userData = { ...data, id, password: hashedPassword };
        await this.repository.create(userData);
        return id;
    }
    async getUsers(companyId) {
        return await this.repository.listByCompany(companyId);
    }
}
exports.UserService = UserService;
