
import { NoveltyRepository } from './novelties.repository';
import { generateUUID } from '../../utils/uuid';

export class NoveltyService {
  private repository = new NoveltyRepository();

  // Types
  async getNoveltyTypes(companyId: string) {
    return await this.repository.findAllTypes(companyId);
  }

  async createNoveltyType(companyId: string, data: any) {
    const id = generateUUID();
    await this.repository.createType({ ...data, id, company_id: companyId });
    return id;
  }

  // Novelties
  async getNovelties(companyId: string) {
    return await this.repository.findAll(companyId);
  }

  async createNovelty(companyId: string, data: any) {
    const id = generateUUID();
    const newNovelty = {
      ...data,
      id,
      company_id: companyId,
      status: 'Pending'
    };
    await this.repository.create(newNovelty);
    return id;
  }

  async approveNovelty(id: string) {
    await this.repository.updateStatus(id, 'Approved');
  }

  async rejectNovelty(id: string) {
    await this.repository.updateStatus(id, 'Rejected');
  }
}
