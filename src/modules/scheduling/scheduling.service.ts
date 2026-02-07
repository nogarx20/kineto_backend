
import { SchedulingRepository } from './scheduling.repository';
import { generateUUID } from '../../utils/uuid';

export class SchedulingService {
  private repository = new SchedulingRepository();

  async getSchedule(companyId: string, startDate: string, endDate: string) {
    return await this.repository.findByDateRange(companyId, startDate, endDate);
  }

  async assignShift(companyId: string, collaboratorId: string, shiftId: string, date: string) {
    const id = generateUUID();
    await this.repository.createOrUpdate({
      id,
      company_id: companyId,
      collaborator_id: collaboratorId,
      shift_id: shiftId,
      date
    });
    return { success: true };
  }

  // Asignación masiva (útil para "Pegar" programación)
  async bulkAssign(companyId: string, assignments: Array<{collaboratorId: string, shiftId: string, date: string}>) {
    for (const item of assignments) {
      await this.assignShift(companyId, item.collaboratorId, item.shiftId, item.date);
    }
    return { count: assignments.length };
  }
}
