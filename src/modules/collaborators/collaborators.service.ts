import { CollaboratorRepository } from './collaborators.repository';
import { v4 as uuidv4 } from 'uuid';

export class CollaboratorService {
  private repository: CollaboratorRepository;

  constructor() {
    this.repository = new CollaboratorRepository();
  }

  async findAll(companyId: string) {
    return await this.repository.findAll(companyId);
  }

  async findById(companyId: string, id: string) {
    return await this.repository.findById(companyId, id);
  }

  async create(companyId: string, data: any) {
    const id = uuidv4();
    await this.repository.create({ ...data, id, company_id: companyId });
    return { id, ...data };
  }

  async update(id: string, companyId: string, data: any) {
    await this.repository.update(id, companyId, data);
    return { id, ...data };
  }

  async delete(id: string, companyId: string) {
    await this.repository.delete(id, companyId);
    return { id };
  }

  // --- Contracts ---
  async listContracts(companyId: string) {
    return await this.repository.listContracts(companyId);
  }

  async createContract(companyId: string, data: any) {
    const id = uuidv4();
    await this.repository.createContract({ ...data, id, company_id: companyId });
    return { id, ...data };
  }

  async updateContract(id: string, companyId: string, data: any) {
    await this.repository.updateContract(id, companyId, data);
    return { id, ...data };
  }

  async deleteContract(id: string, companyId: string) {
    await this.repository.deleteContract(id, companyId);
    return { id };
  }

  // --- Positions ---
  async listPositions(companyId: string) {
    return await this.repository.listPositions(companyId);
  }

  async createPosition(companyId: string, data: any) {
    const id = uuidv4();
    await this.repository.createPosition({ ...data, id, company_id: companyId });
    return { id, ...data };
  }

  async updatePosition(id: string, companyId: string, data: any) {
    await this.repository.updatePosition(id, companyId, data);
    return { id, ...data };
  }

  async deletePosition(id: string, companyId: string) {
    await this.repository.deletePosition(id, companyId);
    return { id };
  }

  // --- Cost Centers ---
  async listCostCenters(companyId: string) {
    return await this.repository.listCostCenters(companyId);
  }

  async createCostCenter(companyId: string, data: any) {
    const id = uuidv4();
    await this.repository.createCostCenter({ ...data, id, company_id: companyId });
    return { id, ...data };
  }
}
