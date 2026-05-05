import { SchedulingRepository } from './scheduling.repository';
import { generateUUID } from '../../utils/uuid';
import pool from '../../config/database';

export class SchedulingService {
  private repository = new SchedulingRepository();

  async getSchedule(companyId: string, startDate: string, endDate: string) {
    return await this.repository.findByDateRange(companyId, startDate, endDate);
  }

  async assignShift(companyId: string, id: string | undefined, collaboratorId: string, shiftId: string, date: string, costCenterId?: string, markingZoneId?: string) {
    // Validar contrato activo y obtener tipo de turno para reglas de negocio
    const [rows]: any = await pool.execute(`
      SELECT c.cost_center_id, c.marking_zone_id, sh.shift_type
      FROM contracts c
      LEFT JOIN shifts sh ON sh.id = ?
      WHERE c.collaborator_id = ? AND c.company_id = ? AND c.status = 'Activo' AND c.onDelete = 0
      AND ? >= c.start_date AND (? <= c.end_date OR c.end_date IS NULL)
    `, [shiftId, collaboratorId, companyId, date, date]);

    if (rows.length === 0) {
      throw new Error(`Acción Denegada: El colaborador no posee un contrato activo o vigente para la fecha ${date}.`);
    }

    const row = rows[0];
    // Si no viene CC o Zona, heredamos del contrato vigente
    const finalCCId = costCenterId || row.cost_center_id;
    
    // El turno de descanso no debe tener geocerca (marking_zone_id = null)
    let finalZoneId = markingZoneId || row.marking_zone_id;
    if (row.shift_type === 'Descanso') {
        finalZoneId = null;
    }

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

  async bulkDelete(companyId: string, ids: string[]) {
    for (const id of ids) {
      await this.repository.delete(companyId, id);
    }
  }
}
