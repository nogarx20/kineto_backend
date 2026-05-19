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
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Obtener el ID real de la base de datos para esta fecha/colaborador
      // Esto evita el error de Foreign Key si ya existe un registro (incluso si onDelete = 1)
      const [existingRaw]: any = await connection.execute(
        'SELECT id FROM schedules WHERE company_id = ? AND collaborator_id = ? AND DATE(date) = DATE(?) LIMIT 1',
        [companyId, collaboratorId, date]
      );
      const scheduleId = existingRaw.length > 0 ? existingRaw[0].id : (id || generateUUID());

      const existingOnDate = await this.repository.findByCollaboratorAndDate(companyId, collaboratorId, date);
      if (existingOnDate && await this.repository.hasAttendance(existingOnDate.id, connection)) {
          if (existingOnDate.is_automatic_marking !== 1) {
              throw new Error("Acción Denegada: El turno actual ya posee registros de asistencia manuales o biométricos y no puede ser modificado.");
          }
      }

    // Validar contrato activo y obtener tipo de turno para reglas de negocio (usando DATE() para evitar fallos por componentes de tiempo)
    const [rows]: any = await connection.execute(`
      SELECT c.cost_center_id, c.marking_zone_id, sh.shift_type
      FROM contracts c
      LEFT JOIN shifts sh ON sh.id = ?
      WHERE c.collaborator_id = ? AND c.company_id = ? AND c.status = 'Activo' AND c.onDelete = 0
      AND DATE(?) >= DATE(c.start_date) AND (DATE(?) <= DATE(c.end_date) OR c.end_date IS NULL)
    `, [shiftId, collaboratorId, companyId, date, date]);

    if (rows.length === 0) {
      // Si no se encuentra un contrato activo para la fecha, buscamos el último contrato
      // para proporcionar feedback detallado en el mensaje de error.
      const [lastContractRows]: any = await connection.execute(`
        SELECT c.contract_code, c.position_name, c.start_date, c.end_date, c.status, c.onDelete, cc.name as cost_center_name
        FROM contracts c
        LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
        WHERE c.collaborator_id = ? AND c.company_id = ? AND c.onDelete = 0
        ORDER BY c.start_date DESC LIMIT 1
      `, [collaboratorId, companyId]);

      if (lastContractRows.length === 0) {
        throw new Error(`Acción Denegada: El colaborador no posee ningún contrato registrado en el sistema para la fecha ${date}.`);
      }

      const lc = lastContractRows[0];
      const startF = new Date(lc.start_date).toLocaleDateString('es-ES');
      const endF = lc.end_date ? new Date(lc.end_date).toLocaleDateString('es-ES') : 'Indefinido';

      let specificReason = '';
      const shiftDateStr = date.split('T')[0]; // Formato YYYY-MM-DD
      const contractStartDateStr = lc.start_date.split('T')[0]; // Formato YYYY-MM-DD
      const contractEndDateStr = lc.end_date ? lc.end_date.split('T')[0] : null; // Formato YYYY-MM-DD o null

      if (lc.status !== 'Activo') {
          specificReason = `El último contrato (${lc.contract_code}) no está en estado 'Activo' (estado actual: ${lc.status}).`;
      } else if (shiftDateStr < contractStartDateStr) {
          specificReason = `El turno (${shiftDateStr}) es anterior a la fecha de inicio del último contrato (${contractStartDateStr}).`;
      } else if (contractEndDateStr && shiftDateStr > contractEndDateStr) {
          specificReason = `El turno (${shiftDateStr}) es posterior a la fecha de fin del último contrato (${contractEndDateStr}).`;
      } else if (lc.onDelete === 1) {
          specificReason = `El último contrato (${lc.contract_code}) está marcado para eliminación.`;
      }

      throw new Error(`Acción Denegada: No existe un contrato activo para la fecha ${date}.
${specificReason ? `\nRazón: ${specificReason}\n` : ''}
Último Contrato: ${lc.contract_code || 'S/N'} | Estado: ${lc.status}
Cargo: ${lc.position_name || 'N/A'}
Centro de Costo: ${lc.cost_center_name || 'N/A'}
Vigencia: ${startF} al ${endF}`);
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
    const [targetShiftData]: any = await connection.execute('SELECT * FROM shifts WHERE id = ?', [shiftId]);
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

    await this.repository.createOrUpdate({
      id: scheduleId,
      company_id: companyId,
      collaborator_id: collaboratorId,
      shift_id: shiftId,
      cost_center_id: finalCCId,
      marking_zone_id: finalZoneId,
      date
    }, connection);

    // Gestionar marcajes automáticos
    if (newShift && newShift.is_automatic_marking == 1) {
        let finalLat = null;
        let finalLng = null;
        if (finalZoneId) { // Si hay una zona de marcaje asignada
            const [z]: any = await connection.execute('SELECT lat, lng FROM marking_zones WHERE id = ?', [finalZoneId]);
            if (z.length > 0) {
                finalLat = z[0].lat;
                finalLng = z[0].lng;
            }
        }
        await this.manageAutoMarkings(scheduleId, companyId, collaboratorId, date, newShift, connection, { zoneId: finalZoneId, lat: finalLat, lng: finalLng });
    } else if (existingOnDate && existingOnDate.is_automatic_marking == 1) {
        await connection.execute('DELETE FROM attendance_records WHERE schedule_id = ?', [scheduleId]);
    }

      await connection.commit();
    return { success: true };
    } catch (error) {
      if (connection) await connection.rollback();
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  private async manageAutoMarkings(scheduleId: string, companyId: string, collaboratorId: string, date: string, shift: any, connection: any = pool, zoneInfo?: { zoneId: string | null, lat: number | null, lng: number | null }) {
    // Limpiar cualquier marcaje previo para evitar duplicados
    await connection.execute('DELETE FROM attendance_records WHERE schedule_id = ?', [scheduleId]);

    const markings: { time: string, type: 'IN' | 'OUT' }[] = [];
    const baseDate = date.split('T')[0];
    const [y, month, dNum] = baseDate.split('-').map(Number);

    const formatForDB = (time: string, offsetDays = 0) => {
        const [h, m, s] = time.split(':').map(Number);
        const d = new Date(y, month - 1, dNum, h, m, s || 0);
        if (offsetDays) d.setDate(d.getDate() + offsetDays);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Primer segmento (Simple o Parte 1 de Partido)
    markings.push({ time: formatForDB(shift.start_time), type: 'IN' });
    const out1Offset = shift.end_time < shift.start_time ? 1 : 0;
    markings.push({ time: formatForDB(shift.end_time, out1Offset), type: 'OUT' });

    // Segundo segmento si es Partido
    if (shift.shift_type === 'Partido' && shift.start_time_2 && shift.end_time_2) {
        const in2Offset = shift.start_time_2 < shift.start_time ? 1 : 0;
        markings.push({ time: formatForDB(shift.start_time_2, in2Offset), type: 'IN' });
        const out2Offset = shift.end_time_2 < shift.start_time ? 1 : 0;
        markings.push({ time: formatForDB(shift.end_time_2, out2Offset), type: 'OUT' });
    }

    for (const m of markings) {
        await connection.execute(
            `INSERT INTO attendance_records (id, company_id, collaborator_id, schedule_id, timestamp, type, lat, lng, marking_zone_id, is_valid_zone, status, biometric_method, validation_method) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [generateUUID(), companyId, collaboratorId, scheduleId, m.time, m.type, zoneInfo?.lat || null, zoneInfo?.lng || null, zoneInfo?.zoneId || null, 1, 'OnTime', 'AUTOMATIC', 'MANUAL']
        );
    }
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
    const sched = await this.repository.findById(companyId, id);
    if (!sched) return { success: true };

    // Validar si tiene asistencia antes de borrar
    const hasAttendance = await this.repository.hasAttendance(id);
    if (hasAttendance) {
        if (sched.is_automatic_marking == 1) {
            // Si es automático, permitimos borrar los marcajes generados
            await pool.execute('DELETE FROM attendance_records WHERE schedule_id = ?', [id]);
        } else {
            throw new Error("Acción Denegada: No es posible eliminar una asignación que ya cuenta con registros de asistencia vinculados.");
        }
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
