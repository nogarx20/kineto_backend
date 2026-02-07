
import { NoveltyRepository } from './novelties.repository';
import { generateUUID } from '../../utils/uuid';

export class NoveltyService {
  private repository = new NoveltyRepository();

  async getNovelties(companyId: string) {
    return await this.repository.findAll(companyId);
  }

  async createNovelty(companyId: string, data: any) {
    const id = generateUUID();
    const newNovelty = {
      ...data,
      id,
      company_id: companyId,
      status: 'Pending' // Por defecto pendiente de aprobación
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
