import { SchedulingRepository } from './scheduling.repository';
import { generateUUID } from '../../utils/uuid';
import pool from '../../config/database';

export class SchedulingService {
  private repository = new SchedulingRepository();

  async getSchedule(companyId: string, startDate: string, endDate: string) {
    return await this.repository.findByDateRange(companyId, startDate, endDate);
  }

  async assignShift(companyId: string, id: string | undefined, collaboratorId: string, shiftId: string, date: string, costCenterId?: string, markingZoneId?: string) {
    // Validar contrato activo para la fecha de programación y no eliminado lógicamente
    const [contracts]: any = await pool.execute(`
      SELECT status, start_date, end_date, cost_center_id, marking_zone_id FROM contracts 
      WHERE collaborator_id = ? AND company_id = ? AND status = 'Activo' AND onDelete = 0
      AND ? >= start_date AND (? <= end_date OR end_date IS NULL)
    `, [collaboratorId, companyId, date, date]);

    if (contracts.length === 0) {
      throw new Error(`Acción Denegada: El colaborador no posee un contrato activo o vigente para la fecha ${date}.`);
    }

    const contract = contracts[0];
    // Si no viene CC o Zona, heredamos del contrato vigente
    const finalCCId = costCenterId || contract.cost_center_id;
    const finalZoneId = markingZoneId || contract.marking_zone_id;

    const scheduleId = id || generateUUID();
    await this.repository.createOrUpdate({
      id: scheduleId,
      company_id: companyId,
      collaborator_id: collaboratorId,
      shift_id: shiftId,
      cost_center_id: finalCCId,
      marking_zone_id: finalZoneId,
      date
    });
    return { success: true };
  }

  async bulkAssign(companyId: string, assignments: Array<{collaboratorId: string, shiftId: string, date: string, costCenterId?: string, markingZoneId?: string}>) {
    let successCount = 0;
    const errors = [];

    for (const item of assignments) {
      try {
        await this.assignShift(companyId, undefined, item.collaboratorId, item.shiftId, item.date, item.costCenterId, item.markingZoneId);
        successCount++;
      } catch (err: any) {
        errors.push({ date: item.date, error: err.message });
      }
    }
    return { count: successCount, errors };
  }
}
