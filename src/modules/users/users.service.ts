
import { UserRepository } from './users.repository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateUUID } from '../../utils/uuid';
import { generateToken } from '../../utils/jwt';

export class UserService {
  private repository = new UserRepository();

  async authenticate(companyId: string, email: string, pass: string) {
    const user = await this.repository.findByEmail(companyId, email);
    if (!user || !user.is_active) throw new Error('Credenciales inválidas');

    const isValid = await comparePassword(pass, user.password);
    if (!isValid) throw new Error('Credenciales inválidas');

    const token = generateToken({
      id: user.id,
      company_id: user.company_id,
      email: user.email
    });

    return { token, user: { id: user.id, firstName: user.first_name, lastName: user.last_name } };
  }

  async createUser(data: any) {
    const existing = await this.repository.findByEmail(data.company_id, data.email);
    if (existing) throw new Error('Email ya registrado en esta empresa');

    const hashedPassword = await hashPassword(data.password);
    const id = generateUUID();

    const userData = { ...data, id, password: hashedPassword };
    await this.repository.create(userData);

    return id;
  }

  async getUsers(companyId: string) {
    return await this.repository.listByCompany(companyId);
  }
}
