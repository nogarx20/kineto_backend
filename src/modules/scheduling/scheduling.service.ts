import { SchedulingRepository } from './scheduling.repository';
import { generateUUID } from '../../utils/uuid';
import pool from '../../config/database';

// Define an interface for scheduling parameters
interface SchedulingParameters {
  min_rest_hours: number;
  max_daily_extra_hours: number;
  max_weekly_extra_hours: number;
}

export class SchedulingService {
  private repository = new SchedulingRepository();

  async getSchedule(companyId: string, startDate: string, endDate: string) {
    return await this.repository.findByDateRange(companyId, startDate, endDate);
  }

  async assignShift(companyId: string, id: string | undefined, collaboratorId: string, shiftId: string, date: string, costCenterId?: string, markingZoneId?: string) {
    // 1. Si estamos reasignando, validar que el turno actual no tenga marcajes
    // If the existing schedule is the same as the new one, do nothing.
    // This prevents unnecessary updates and potential errors if the existing one has attendance.
    // This check is important for the quick fill actions.
    
    const existingOnDate = await this.repository.findByCollaboratorAndDate(companyId, collaboratorId, date);
    if (existingOnDate && await this.repository.hasAttendance(existingOnDate.id)) {
        throw new Error("Acción Denegada: El turno actual ya posee registros de asistencia y no puede ser modificado.");
    }

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

    // --- VALIDACIÓN DE CRUCE DE HORARIOS ---
    const params: SchedulingParameters = await this.repository.getParameters(companyId);
    const [targetShiftData]: any = await pool.execute('SELECT * FROM shifts WHERE id = ?', [shiftId]);
    const newShift = targetShiftData[0];

    if (newShift.shift_type !== 'Descanso') {
        // Obtener turnos de ayer y mañana
        const prevDate = new Date(new Date(date).getTime() - 86400000).toISOString().split('T')[0];
        const nextDate = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

        const prevSched = await this.repository.findByCollaboratorAndDate(companyId, collaboratorId, prevDate);
        const nextSched = await this.repository.findByCollaboratorAndDate(companyId, collaboratorId, nextDate);

        const getIntervals = (d: string, s: any) => {
            if (!s || s.shift_type === 'Descanso') return [];
            const res = [];
            const start = new Date(`${d}T${s.start_time}`);
            const end = new Date(`${d}T${s.end_time}`);
            if (end < start) end.setDate(end.getDate() + 1);
            res.push({ start, end });
            if (s.shift_type === 'Partido' && s.start_time_2) {
                const start2 = new Date(`${d}T${s.start_time_2}`);
                const end2 = new Date(`${d}T${s.end_time_2}`);
                if (end2 < start2) end2.setDate(end2.getDate() + 1);
                res.push({ start: start2, end: end2 });
            }
            return res;
        };

        const newIntervals = getIntervals(date, newShift);
        const prevIntervals = getIntervals(prevDate, prevSched);

        // Validar contra el turno anterior (Cruce y Descanso mínimo)
        if (prevIntervals.length > 0 && newIntervals.length > 0) {
            const lastPrevEnd = prevIntervals[prevIntervals.length - 1].end;
            const firstNewStart = newIntervals[0].start;
            const diffHours = (firstNewStart.getTime() - lastPrevEnd.getTime()) / (1000 * 60 * 60);

            if (diffHours < 0) throw new Error(`Conflicto de Horario: El turno anterior termina a las ${lastPrevEnd.toLocaleTimeString()} y el nuevo inicia a las ${firstNewStart.toLocaleTimeString()}. Los horarios se cruzan.`);
            if (diffHours < params.min_rest_hours) throw new Error(`Incumplimiento de Descanso: Entre el turno anterior y el nuevo solo hay ${diffHours.toFixed(1)}h de descanso. El mínimo parametrizado es ${params.min_rest_hours}h.`);
        }
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

  async deleteShift(companyId: string, id: string) {
    // Validar si tiene asistencia antes de borrar
    const hasAttendance = await this.repository.hasAttendance(id);
    if (hasAttendance) {
        throw new Error("Acción Denegada: No es posible eliminar una asignación que ya cuenta con registros de asistencia vinculados.");
    }
    await this.repository.delete(companyId, id);
    return { success: true };
  }

  async bulkDelete(companyId: string, ids: string[]) {
    for (const id of ids) {
      try {
        await this.deleteShift(companyId, id);
      } catch (e) {
        // En borrado masivo omitimos los que tengan error (marcajes)
      }
    }
  }

  async saveParameters(companyId: string, userId: string, params: { min_rest_hours: number, max_daily_extra_hours: number, max_weekly_extra_hours: number }) {
    const id = generateUUID();
    await this.repository.createParameters({ id, company_id: companyId, user_id: userId, ...params });
    return { success: true, id };
  }
}
