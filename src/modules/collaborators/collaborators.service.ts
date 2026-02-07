
import { CollaboratorRepository } from './collaborators.repository';
import { generateUUID } from '../../utils/uuid';

export class CollaboratorService {
  private repository = new CollaboratorRepository();

  async getCollaborators(companyId: string) {
    return await this.repository.findAll(companyId);
  }

  async createCollaborator(companyId: string, data: any) {
    // Validar si existe identificación (TODO: Implementar check en repositorio si es necesario, 
    // pero la DB ya tiene restricción UNIQUE)
    
    const id = generateUUID();
    const newCollaborator = {
      ...data,
      id,
      company_id: companyId
    };
    
    await this.repository.create(newCollaborator);
    return id;
  }

  // Auxiliares
  async createPosition(companyId: string, name: string) {
    const id = generateUUID();
    await this.repository.createPosition({ id, company_id: companyId, name });
    return id;
  }

  async getPositions(companyId: string) {
    return await this.repository.listPositions(companyId);
  }

  async createCostCenter(companyId: string, code: string, name: string) {
    const id = generateUUID();
    await this.repository.createCostCenter({ id, company_id: companyId, code, name });
    return id;
  }

  async getCostCenters(companyId: string) {
    return await this.repository.listCostCenters(companyId);
  }
}
