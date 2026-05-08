import { UserRepository } from './users.repository';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateUUID } from '../../utils/uuid';
import { generateToken } from '../../utils/jwt';

const MAX_FAILED_ATTEMPTS = 5;

export class UserService {
  private repository = new UserRepository();

  async authenticate(email: string, pass: string, companyId?: string) {
    // 1. Buscar el registro único del usuario por email
    // Asumimos que el repositorio ahora tiene findGlobalByEmail que trae datos del usuario
    const user = await this.repository.findGlobalByEmail(email);

    if (!user) throw new Error('Credenciales inválidas');
    if (!user.is_active) throw new Error('Cuenta de usuario inactiva.');
    if (user.is_locked) throw new Error('Su acceso ha sido restringido por la administración corporativa.');

    // 2. Validar contraseña una sola vez
    const isValid = await comparePassword(pass, user.password);
    
    if (!isValid) {
      await this.repository.incrementFailedAttempts(user.id);
      if (user.failed_attempts + 1 >= MAX_FAILED_ATTEMPTS) {
        await this.repository.lockAccount(user.id);
        throw new Error('La cuenta ha sido bloqueada tras 5 intentos fallidos por seguridad.');
      }
      throw new Error('Credenciales inválidas');
    }

    // 3. Resetear intentos fallidos
    await this.repository.resetAttempts(user.id);

    // 4. Obtener empresas relacionadas
    // Asumimos que el repositorio devuelve [ {id, name} ] desde la tabla user_companies
    const companies = await this.repository.getRelatedCompanies(user.id);
    
    if (!companies || companies.length === 0) {
      throw new Error('El usuario no tiene organizaciones asignadas.');
    }

    // Si se especificó una empresa para login directo, filtramos
    const targetCompanies = companyId 
      ? companies.filter((c: any) => c.id === companyId) 
      : companies;

    if (targetCompanies.length === 0) throw new Error('No tiene acceso a la empresa seleccionada.');

    const loginOptions = targetCompanies.map((comp: any) => {
      const token = generateToken({
        id: user.id,
        company_id: comp.id,
        email: user.email
      });
      
      return {
        token,
        companyId: comp.id, // CRUCIAL: Añadido para que el frontend lo reconozca
        companyName: comp.name,
        role: comp.role_name,
        user: { 
          id: user.id, 
          firstName: user.first_name, 
          lastName: user.last_name,
          email: user.email,
          photo: user.photo
        }
      };
    });

    // Identificar el login para la empresa por defecto (de la tabla users)
    // Si se solicitó una empresa específica (companyId), se prioriza esa.
    const selectedLogin = companyId 
      ? loginOptions.find((o: any) => o.companyId === companyId)
      : (loginOptions.find((o: any) => o.companyId === user.company_id) || loginOptions[0]);

    // Devolvemos el acceso exitoso junto con todas las opciones disponibles
    return { ...selectedLogin, options: loginOptions };
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
