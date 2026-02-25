import { UserRepository } from './users.repository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateUUID } from '../../utils/uuid';
import { generateToken } from '../../utils/jwt';

const MAX_FAILED_ATTEMPTS = 5;

export class UserService {
  private repository = new UserRepository();

  async authenticate(email: string, pass: string, companyId?: string) {
    // Buscar usuarios asociados al email
    const users = companyId 
        ? [await this.repository.findByEmail(companyId, email)]
        : await this.repository.findAllByEmailGlobal(email);

    if (!users || users.length === 0 || !users[0]) throw new Error('Credenciales inválidas');

    const validLogins = [];
    for (const user of users) {
      if (!user.is_active) continue;

      // RESTRICCIÓN: Verificar si el estado del usuario es bloqueado (is_locked)
      if (user.is_locked) {
        throw new Error('Su acceso ha sido restringido por la administración corporativa.');
      }

      const isValid = await comparePassword(pass, user.password);
      
      if (isValid) {
        // Exito: Resetear intentos si no está bloqueado
        await this.repository.resetAttempts(user.id);
        
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
      } else {
        // Fallo: Incrementar intentos
        await this.repository.incrementFailedAttempts(user.id);
        
        // Verificar si debemos bloquear por intentos fallidos
        if (user.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS) {
          await this.repository.lockAccount(user.id);
          throw new Error('La cuenta ha sido bloqueada tras 5 intentos fallidos por seguridad.');
        }
      }
    }

    if (validLogins.length === 0) throw new Error('Credenciales inválidas');
    if (validLogins.length === 1) return validLogins[0];
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
    const users = await this.repository.listByCompany(companyId);
    return users.map((u: any) => {
      const roles = typeof u.roles === 'string' ? JSON.parse(u.roles) : (u.roles || []);
      return { 
        ...u, 
        roles: roles.map((r: any) => ({ ...r, is_active: !!r.is_active })),
        role_ids: roles.map((r: any) => r.id) 
      };
    });
  }

  async unlockUser(companyId: string, userId: string) {
    const user = await this.repository.findById(companyId, userId);
    if (!user) throw new Error('Usuario no encontrado');
    await this.repository.resetAttempts(userId);
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.repository.findGlobalByEmail(email);
    if (!user) throw new Error('Si el correo existe en nuestro sistema, recibirá instrucciones.');
    return { success: true, message: 'Se ha enviado la información a su correo electrónico.' };
  }
}
