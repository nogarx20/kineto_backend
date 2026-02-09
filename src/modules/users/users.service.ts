
import { UserRepository } from './users.repository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateUUID } from '../../utils/uuid';
import { generateToken } from '../../utils/jwt';

export class UserService {
  private repository = new UserRepository();

  async authenticate(email: string, pass: string, companyId?: string) {
    // Si se provee companyId, mantenemos el comportamiento original por compatibilidad
    if (companyId) {
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

    // Login global: Buscar todas las cuentas asociadas al email
    const users = await this.repository.findAllByEmailGlobal(email);
    if (!users || users.length === 0) throw new Error('Credenciales inválidas');

    // Filtrar usuarios con password válido
    const validLogins = [];
    for (const user of users) {
      if (!user.is_active) continue;
      const isValid = await comparePassword(pass, user.password);
      if (isValid) {
        const token = generateToken({
          id: user.id,
          company_id: user.company_id,
          email: user.email
        });
        validLogins.push({
          token,
          companyName: user.company_name,
          user: { id: user.id, firstName: user.first_name, lastName: user.last_name }
        });
      }
    }

    if (validLogins.length === 0) throw new Error('Credenciales inválidas');

    // Si solo hay un acceso válido, retornarlo directamente
    if (validLogins.length === 1) {
      return validLogins[0];
    }

    // Si hay múltiples accesos, retornar la lista para que el cliente elija
    return { multiple: true, options: validLogins };
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
