
import { ShiftRepository } from './shifts.repository';
import { generateUUID } from '../../utils/uuid';

export class ShiftService {
  private repository = new ShiftRepository();

  // Zones
  async getZones(companyId: string) {
    return await this.repository.findAllZones(companyId);
  }

  async createZone(companyId: string, data: any) {
    const id = generateUUID();
    await this.repository.createZone({ ...data, id, company_id: companyId });
    return id;
  }

  // Shifts
  async getShifts(companyId: string) {
    return await this.repository.findAllShifts(companyId);
  }

  async createShift(companyId: string, data: any) {
    const id = generateUUID();
    await this.repository.createShift({ ...data, id, company_id: companyId });
    return id;
  }
}
