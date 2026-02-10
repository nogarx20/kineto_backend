
import { SchedulingRepository } from './scheduling.repository';
import { generateUUID } from '../../utils/uuid';
import pool from '../../config/database';

export class SchedulingService {
  private repository = new SchedulingRepository();

  async getSchedule(companyId: string, startDate: string, endDate: string) {
    return await this.repository.findByDateRange(companyId, startDate, endDate);
  }

  async assignShift(companyId: string, collaboratorId: string, shiftId: string, date: string) {
    // Validar contrato activo para la fecha de programación
    const [contracts]: any = await pool.execute(`
      SELECT status, start_date, end_date FROM contracts 
      WHERE collaborator_id = ? AND company_id = ? AND status = 'Activo'
      AND ? >= start_date AND (? <= end_date OR end_date IS NULL)
    `, [collaboratorId, companyId, date, date]);

    if (contracts.length === 0) {
      throw new Error(`Acción Denegada: El colaborador no posee un contrato activo o vigente para la fecha ${date}.`);
    }

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

  async bulkAssign(companyId: string, assignments: Array<{collaboratorId: string, shiftId: string, date: string}>) {
    let successCount = 0;
    let errors = [];

    for (const item of assignments) {
      try {
        await this.assignShift(companyId, item.collaboratorId, item.shiftId, item.date);
        successCount++;
      } catch (err: any) {
        errors.push({ date: item.date, error: err.message });
      }
    }
    return { count: successCount, errors };
  }
}
