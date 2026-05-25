import { ReportsRepository } from './reports.repository';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

export class ReportsService {
  private repository = new ReportsRepository();

  async getDashboardStats(companyId: string, userId: string, range: string = '7d') {
    // Obtener fecha actual en zona horaria regional (Colombia)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    // Calcular rango de fechas para la gráfica
    const startDate = new Date();
    if (range === '15d') startDate.setDate(startDate.getDate() - 15);
    else if (range === '30d') startDate.setDate(startDate.getDate() - 30);
    else startDate.setDate(startDate.getDate() - 7); // Default 7d
    const startDateStr = startDate.toISOString().split('T')[0];

    const [
      totalWorkforce,
      schedulesToday,
      markingsToday,
      trendData,
      recentActivityRaw,
      securityLogsRaw,
      distribution
    ] = await Promise.all([
      this.repository.getTotalActiveWorkforce(companyId),
      this.repository.getSchedulesForDate(companyId, today),
      this.repository.getMarkingsForDate(companyId, today),
      this.repository.getTrendData(companyId, startDateStr, today),
      this.repository.getEnrichedRecentActivity(companyId, 100), // Traemos más para filtrar duplicados
      this.repository.getUserSecurityLogs(companyId, userId, 20),
      this.repository.getAttendanceDistribution(companyId)
    ]);

    // 1. Cálculo de Tasa de Cumplimiento
    let compliantShifts = 0;
    let totalScheduled = schedulesToday.length;
    
    // Agrupar marcajes por colaborador
    const markingsByCollab: Record<string, number> = {};
    let zoneAlertsCount = 0;
    let validMarkingsCount = 0;

    markingsToday.forEach((m: any) => {
      markingsByCollab[m.collaborator_id] = (markingsByCollab[m.collaborator_id] || 0) + 1;
      
      // Verificar alertas: Problema con zona (0) O problema con turno (null)
      if (m.is_valid_zone === 1 && m.schedule_id) {
        validMarkingsCount++;
      } else {
        zoneAlertsCount++;
      }
    });

    schedulesToday.forEach((s: any) => {
      const marks = markingsByCollab[s.collaborator_id] || 0;
      if (s.shift_type === 'Descanso') {
        // Si es descanso, cumple si tiene 0 marcajes (o simplemente no cuenta para la tasa de "asistencia")
        // Para este KPI, asumiremos que "Cumplimiento" se refiere a turnos laborales asistidos.
        // Si es descanso, lo excluimos del total programado para no afectar la tasa de asistencia.
        totalScheduled--; 
      } else if (s.shift_type === 'Partido') {
        if (marks >= 4) compliantShifts++;
      } else {
        // Simple
        if (marks >= 2) compliantShifts++;
      }
    });

    const complianceRate = totalScheduled > 0 ? Math.round((compliantShifts / totalScheduled) * 100) : 100;

    // 2. Formatear Datos de Gráfica
    // Rellenar días faltantes con 0
    const chartDataMap = new Map(trendData.map((d: any) => [d.date.toISOString().split('T')[0], d.ejecutado]));
    const chartData = [];
    const currentDate = new Date(startDate);
    const end = new Date();
    
    while (currentDate <= end) {
      const dStr = currentDate.toISOString().split('T')[0];
      // Nombre del día (Lun, Mar...)
      const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      chartData.push({
        name: dayName,
        date: dStr,
        ejecutado: chartDataMap.get(dStr) || 0,
        programado: 0, // TODO: Calcular programado histórico si es necesario, por ahora 0 o estimado
        puntualidad: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. Formatear Actividad Reciente (Con Deduplicación)
    const uniqueActivity: any[] = [];
    
    for (const act of recentActivityRaw) {
      // Algoritmo de deduplicación:
      // Ignorar si existe un registro del mismo colaborador, mismo tipo (IN/OUT) y diferencia < 1 minuto
      const isDuplicate = uniqueActivity.some(existing => 
        existing.identification === act.identification && 
        existing.type === act.type && 
        Math.abs(new Date(existing.timestamp).getTime() - new Date(act.timestamp).getTime()) < 60000
      );

      if (!isDuplicate) uniqueActivity.push(act);
      if (uniqueActivity.length >= 20) break; // Limitar a 20 visuales
    }

    const recentActivity = uniqueActivity.map((l: any) => {
      return {
        id: l.id,
        name: `${l.first_name} ${l.last_name}`,
        identification: l.identification,
        photo: l.photo,
        costCenter: l.cost_center || 'N/A',
        time: l.timestamp, // Mantener el timestamp original sin formatear
        type: l.type,
        valid: l.is_valid_zone === 1,
        zoneName: l.zone_name || 'Ubicación Desconocida',
        shiftName: l.shift_name,
        biometricMethod: l.biometric_method, // Asegurar que se envía
        status: l.status // Asegurar que se envía
      };
    });

    // 4. Formatear Logs de Seguridad (Humanización)
    const securityLogs = securityLogsRaw.map((l: any) => {
      const detailsObj = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
      
      // Mapeo de Entidades (Tablas -> Menús)
      const entityMap: Record<string, string> = {
          'users': 'Gestión de Usuarios',
          'collaborators': 'Colaboradores',
          'contracts': 'Contratos',
          'shifts': 'Turnos',
          'marking_zones': 'Geocercas',
          'companies': 'Compañia',
          'auth': 'Acceso',
          'biometrics': 'Biometría',
          'novelties': 'Novedades',
          'schedules': 'Programación',
          'cost_centers': 'Centros de Costo',
          'positions': 'Cargos',
          'roles': 'Roles y Permisos'
      };
      
      // Mapeo de Campos (Diccionario de traducción)
      const fieldMap: Record<string, string> = {
          'first_name': 'Nombres',
          'last_name': 'Apellidos',
          'email': 'Correo',
          'phone': 'Teléfono',
          'address': 'Dirección',
          'identification': 'Identificación',
          'password': 'Contraseña',
          'role_ids': 'Roles',
          'is_active': 'Estado',
          'is_locked': 'Bloqueo',
          'position_name': 'Cargo',
          'cost_center_id': 'Centro Costos',
          'salary': 'Salario',
          'start_date': 'Fecha Inicio',
          'end_date': 'Fecha Fin',
          'name': 'Nombre',
          'code': 'Código',
          'description': 'Descripción',
          'zone_type': 'Tipo Zona',
          'radius': 'Radio',
          'lat': 'Latitud',
          'lng': 'Longitud',
          'is_automatic_marking': 'Marcaje Auto',
          'shift_type': 'Tipo Turno',
          'start_time': 'Hora Inicio',
          'end_time': 'Hora Fin',
          'entry_start_buffer': 'Margen Entrada',
          'exit_end_buffer': 'Margen Salida',
          'lunch_start': 'Inicio Almuerzo',
          'lunch_end': 'Fin Almuerzo',
          'marking_zones_json': 'Geocercas',
          'pin': 'PIN',
          'contract_type': 'Tipo Contrato',
          'weekly_hours': 'Horas Semanales',
          'working_days': 'Días Laborales'
      };

      const humanEntity = entityMap[l.entity] || l.entity;
      let humanAction = l.action;
      let humanDetails = 'Evento registrado';

      // Mapeo de Acciones
      switch (l.action) {
          case 'LOGIN':
              humanAction = 'Inicio de Sesión';
              humanDetails = 'Acceso autorizado al sistema';
              break;
          case 'LOGOUT':
              humanAction = 'Cierre de Sesión';
              humanDetails = 'Desconexión de usuario';
              break;
          case 'LOGIN_FAILED':
              humanAction = 'Acceso Fallido';
              humanDetails = 'Credenciales incorrectas';
              break;
          case 'CREATE':
              humanAction = 'Creación';
              humanDetails = l.entity === 'collaborators' ? `Nuevo ingreso: ${detailsObj?.first_name || ''} ${detailsObj?.last_name || ''}` : 'Registro creado exitosamente';
              break;
          case 'UPDATE':
              humanAction = 'Actualización';
              if (detailsObj?.changes) {
                  const changedFields = Object.keys(detailsObj.changes).map(k => fieldMap[k] || k).join(', ');
                  humanDetails = `Modificado: ${changedFields}`;
              } else {
                  humanDetails = 'Información actualizada';
              }
              break;
          case 'DELETE':
              humanAction = 'Eliminación';
              humanDetails = 'Registro eliminado permanentemente';
              break;
          default:
              humanDetails = typeof detailsObj === 'object' ? 'Detalles técnicos disponibles' : String(detailsObj || '');
      }

      return {
        id: l.id,
        action: humanAction,
        entity: humanEntity,
        details: humanDetails,
        time: new Date(l.createdAt).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };
    });

    // 5. Pie Data (Distribución)
    const colorMap: any = {
      'OnTime': '#10b981',
      'LateEntry': '#f59e0b',
      'LateDeparture': '#f59e0b',
      'EarlyDeparture': '#f97316',
      'EarlyEntry': '#f97316',
      'Overtime': '#3b82f6',
      'Unknown': '#94a3b8',
      'WrongGeofence': '#ef4444',
      'NoTurn': '#64748b',
      'NoRecognition': '#ef4444'
    };
    const pieData = distribution.map((d: any) => ({
      name: d.status,
      value: d.count,
      color: colorMap[d.status] || '#94a3b8'
    }));

    return { 
      totalWorkforce,
      complianceRate,
      todayMarkings: validMarkingsCount,
      zoneAlerts: zoneAlertsCount,
      chartData, 
      pieData, 
      recentActivity,
      securityLogs
    };
  }

  async getAuditLogs(companyId: string) {
    return await this.repository.getAuditLogs(companyId);
  }

  async getActivityLog(companyId: string, params: { page: number, limit: number, search?: string, range: string, startDate?: string, endDate?: string, status?: string }) {
    const offset = (params.page - 1) * params.limit;
    // El repositorio debe ejecutar un JOIN entre attendance_records, collaborators, shifts, cost_centers y marking_zones
    return await this.repository.getActivityLog(companyId, { ...params, offset });
  }

  async getAttendanceControl(companyId: string, date: string) {
    const [rawData, noveltiesResult, companyResult]: any = await Promise.all([
      this.repository.getAttendanceControlData(companyId, date),
      pool.query(
        `SELECT n.*, nt.name as novelty_type_name, nt.prefix as novelty_prefix, nt.period as novelty_period
         FROM novelties n
         JOIN novelty_types nt ON n.novelty_type_id = nt.id
         WHERE n.company_id = ? AND n.status = 'Approved'
         AND DATE(?) BETWEEN DATE(n.start_date) AND COALESCE(DATE(n.end_date), DATE(n.start_date)) and n.onDelete = 0`,
        [companyId, date]
      ),
      pool.query('SELECT settings FROM companies WHERE id = ?', [companyId])
    ]);

    const novelties = noveltiesResult[0] || [];
    const companySettings = typeof companyResult[0][0]?.settings === 'string' ? JSON.parse(companyResult[0][0].settings) : (companyResult[0][0]?.settings || {});
    const roundingMinutes = parseInt(companySettings.roundingMinutes) || 0;

    const groups = new Map();
    rawData.forEach((row: any) => {
      if (!groups.has(row.collaborator_id)) {
        groups.set(row.collaborator_id, {
          schedule_id: row.schedule_id || null,
          collaborator: {
            id: row.collaborator_id,
            name: `${row.first_name} ${row.last_name}`,
            identification: row.identification,
            photo: row.photo,
            email: row.email,
            weekly_hours: row.weekly_hours,
            working_days: row.working_days
          },
          shift: {
            name: row.shift_name,
            shift_prefix: row.shift_prefix || 'TD',
            type: row.shift_type || 'N/A',
            start_time: row.start_time,
            end_time: row.end_time,
            start_time_2: row.start_time_2,
            end_time_2: row.end_time_2,
            lunch_start: row.lunch_start,
            lunch_end: row.lunch_end
          },
          cost_center: row.cost_center_name,
          markings: []
        });
      }
      if (row.marking_id) {
        groups.get(row.collaborator_id).markings.push({
          id: row.marking_id,
          timestamp: row.marking_timestamp,
          type: row.marking_type,
          status: row.marking_status,
          method: row.biometric_method
        });
      }
    });

    return Array.from(groups.values()).map(g => {
      const isPartido = g.shift?.type === 'Partido';
      const markingsIn = g.markings.filter((m: any) => m.type === 'IN').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const markingsOut = g.markings.filter((m: any) => m.type === 'OUT').sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const in1 = markingsIn[0] || null;
      const out1 = isPartido ? (markingsOut.length > 1 ? markingsOut[0] : null) : (markingsOut[markingsOut.length - 1] || null);
      const in2 = isPartido ? (markingsIn.length > 1 ? markingsIn[markingsIn.length - 1] : null) : null;
      const out2 = isPartido ? (markingsOut[markingsOut.length - 1] || null) : null;

      const getRoundedTime = (ts: any) => {
        if (!ts) return 0;
        let cleanStr = String(ts);
        if (cleanStr.includes(' ') && !cleanStr.includes('T')) {
          cleanStr = cleanStr.replace(' ', 'T');
        }
        if (!cleanStr.includes('Z') && !cleanStr.includes('+')) {
          cleanStr += 'Z';
        }
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return 0;
        if (roundingMinutes <= 0) return d.getTime();
        const ms = 1000 * 60 * roundingMinutes;
        return Math.round(d.getTime() / ms) * ms;
      };

      // --- CÁLCULO DE HORAS LABORADAS ---
      let worked_ms = 0;
      if (in1 && out1) worked_ms += getRoundedTime(out1.timestamp) - getRoundedTime(in1.timestamp);
      if (in2 && out2) worked_ms += getRoundedTime(out2.timestamp) - getRoundedTime(in2.timestamp);

      // Calcular duración del almuerzo para restar
      let lunch_ms = 0;
      if (g.shift.lunch_start && g.shift.lunch_end) {
        const [h1, m1] = g.shift.lunch_start.split(':').map(Number);
        const [h2, m2] = g.shift.lunch_end.split(':').map(Number);
        lunch_ms = ((h2 * 60 + m2) - (h1 * 60 + m1)) * 60000;
        if (lunch_ms < 0) lunch_ms += 24 * 60 * 60000; // Cruce de medianoche
      }

      // Neto: (Marcajes) - Almuerzo (solo si hubo marcajes suficientes)
      const net_ms = worked_ms > 0 ? Math.max(0, worked_ms - lunch_ms) : 0;
      const worked_hours = (net_ms / (1000 * 60 * 60)).toFixed(2);

      // Vincular novedades
      const collabNovelties = (novelties[0] || []).filter((n: any) => n.collaborator_id === g.collaborator.id).map((n: any) => {
        let hours = 0;
        if (n.novelty_period === 'Hora') {
          const [h1, m1] = n.start_time.split(':').map(Number);
          const [h2, m2] = n.end_time.split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 1440;
          hours = diff / 60;
        } else {
          // Para novedades por día, las horas deben ser las totales del turno asignado
          if (g.shift && g.shift.type !== 'Descanso' && g.shift.type !== 'N/A') {
            let shiftHours = 0;
            const getShiftDuration = (start?: string, end?: string) => {
              if (!start || !end) return 0;
              const [h1, m1] = start.split(':').map(Number);
              const [h2, m2] = end.split(':').map(Number);
              let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
              if (diff < 0) diff += 1440; // Manejar turnos nocturnos que cruzan la medianoche
              return diff / 60;
            };

            shiftHours += getShiftDuration(g.shift.start_time, g.shift.end_time);
            if (g.shift.type === 'Partido' && g.shift.start_time_2 && g.shift.end_time_2) {
              shiftHours += getShiftDuration(g.shift.start_time_2, g.shift.end_time_2);
            }
            // Restar almuerzo para turnos simples
            if (g.shift.type === 'Simple' && g.shift.lunch_start && g.shift.lunch_end) {
              shiftHours -= getShiftDuration(g.shift.lunch_start, g.shift.lunch_end);
            }
            hours = shiftHours;
          } else {
            hours = 0; // Si no hay turno o es de descanso, la novedad por día cuenta 0 horas
          }
        }
        return { ...n, applied_hours: hours.toFixed(2) };
      });

      const hasDayNov = collabNovelties.some((n: any) => n.novelty_period === 'Día');

      let general_status = 'Inasistencia';
      if (hasDayNov) {
        general_status = 'Novedad';
      } else if (!g.schedule_id) {
        general_status = collabNovelties.length > 0 ? 'Observaciones' : 'Libre / Sin Turno';
      } else {
      const required = isPartido ? 4 : 2;
      const present = [in1, out1, in2, out2].filter(Boolean).length;
      if (present === 0) {
          general_status = collabNovelties.length > 0 ? 'Cumplido (Novedad)' : 'Inasistencia';
      } else if (present < required) {
        general_status = 'Incompleto';
      } else {
        const hasBadStatus = [in1, out1, in2, out2].filter(Boolean).some((m: any) => 
          ['LateEntry', 'EarlyDeparture'].includes(m.status)
        );
        general_status = hasBadStatus ? 'Observaciones' : 'Cumplido';
      }
      }

      return { ...g, in1, out1, in2, out2, worked_hours, novelties: collabNovelties, general_status };
    });
  }

  /**
   * Realiza el análisis técnico de un marcaje basado en reglas de negocio (Horarios, Geocercas, Tolerancias)
   */
  private async calculateMarkingAnalysis(companyId: string, id: string, data: any) {
    const [record]: any = await pool.query(
      'SELECT r.*, c.id as collaborator_id, c.first_name, c.last_name, c.email, c.identification, c.photo FROM attendance_records r JOIN collaborators c ON r.collaborator_id = c.id WHERE r.id = ? AND r.company_id = ?',
      [id, companyId]
    );
    if (!record || record.length === 0) throw new Error('Registro no encontrado');
    const r = record[0];
    const collaboratorId = r.collaborator_id;
    const timestamp = data.timestamp || r.timestamp;
    const datePart = (typeof timestamp === 'string' ? timestamp : timestamp.toISOString()).split('T')[0].split(' ')[0];

    // Obtener tolerancia de la empresa desde settings
    const [company]: any = await pool.query('SELECT settings FROM companies WHERE id = ?', [companyId]);
    const settings = typeof company[0]?.settings === 'string' ? JSON.parse(company[0].settings) : (company[0]?.settings || {});
    const travelTolerance = Number(settings.travelTolerance || 0);

    let shift;
    let hasExistingSchedule = false;
    let scheduleMarkingZoneId = null; // To store marking_zone_id from schedule if found

    if (data.shift_id) {
        // If data.shift_id is provided, fetch only shift details.
        // The marking_zone_id for validation will come from data.marking_zone_id or the original record.
        const [rows]: any = await pool.query('SELECT sh.* FROM shifts sh WHERE sh.id = ? AND sh.company_id = ?', [data.shift_id, companyId]);
        shift = rows[0];
    } else {
        // 1. Intentar por schedule_id vinculado
        const [shiftRows]: any = await pool.query(
          `SELECT sh.*, sd.marking_zone_id FROM shifts sh
           JOIN schedules sd ON sd.shift_id = sh.id
           WHERE sd.id = ?`,
          [r.schedule_id] // This schedule_id comes from attendance_records
        );
        
        if (shiftRows[0]) {
            shift = shiftRows[0];
            scheduleMarkingZoneId = shiftRows[0].marking_zone_id;
        } else {
            // 2. Si no tiene vínculo, buscar si ya existe una programación activa para ese colaborador/fecha
            const [activeSched]: any = await pool.query(
                'SELECT sh.*, sd.id as schedule_id, sd.marking_zone_id FROM shifts sh JOIN schedules sd ON sd.shift_id = sh.id WHERE sd.collaborator_id = ? AND DATE(sd.date) = DATE(?) AND sd.company_id = ? AND sd.onDelete = 0 LIMIT 1',
                [collaboratorId, datePart, companyId]
            );
            if (activeSched[0]) {
                shift = activeSched[0];
                hasExistingSchedule = true;
                scheduleMarkingZoneId = activeSched[0].marking_zone_id;
            }
        }
    }

    // Determine the markingZoneId to use for geofence validation
    // Priority: data.marking_zone_id (user input) -> scheduleMarkingZoneId (from detected schedule) -> r.marking_zone_id (original record)
    const markingZoneId = data.marking_zone_id || scheduleMarkingZoneId || r.marking_zone_id;
    
    const finalLat = data.lat !== undefined ? data.lat : r.lat;
    const finalLng = data.lng !== undefined ? data.lng : r.lng;
    let type = r.type;
    let status = 'OnTime';
    let isValidZone = r.is_valid_zone;

    if (shift && shift.shift_type !== 'Descanso') {
      // Normalizar timestamp para comparaciones seguras en zona horaria Colombia
      const tsStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString().replace('T', ' ').substring(0, 19);
      // datePart is already defined
      const timePart = tsStr.split(' ')[1].substring(0, 5);
      const markingDate = new Date(`${datePart}T${timePart}:00-05:00`);

      const checkWindow = (targetTime: string, before: number, after: number, dayOffset = 0) => {
        if (!targetTime) return null;
        const [h, m] = targetTime.split(':').map(Number);
        const target = new Date(`${datePart}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00-05:00`);
        if (dayOffset) target.setDate(target.getDate() + dayOffset);
        const startLimit = new Date(target.getTime() - (before * 60000));
        const endLimit = new Date(target.getTime() + (after * 60000));
        return { inWindow: markingDate >= startLimit && markingDate <= endLimit, target };
      };

      // Evaluar ventanas de tiempo
      const winIn1 = checkWindow(shift.start_time, shift.entry_start_buffer || 0, shift.entry_end_buffer || 0);
      const isOut1Rollover = shift.end_time < shift.start_time ? 1 : 0;
      const winOut1 = checkWindow(shift.end_time, shift.exit_start_buffer || 0, shift.exit_end_buffer || 0, isOut1Rollover);

      if (winIn1?.inWindow) {
        type = 'IN';
        const lateLimit = new Date(winIn1.target.getTime() + (travelTolerance * 60000));
        status = markingDate > lateLimit ? 'LateEntry' : 'OnTime';
      } else if (winOut1?.inWindow) {
        type = 'OUT';
        const shiftEndTime = winOut1.target.getTime();
        const toleranceMs = travelTolerance * 60000;
        const earlyLimit = shiftEndTime - toleranceMs;
        const lateLimit = shiftEndTime + toleranceMs;

        if (markingDate.getTime() < earlyLimit) {
          status = 'EarlyDeparture';
        } else if (markingDate.getTime() > lateLimit) {
          status = 'LateDeparture';
        } else {
          status = 'OnTime';
        }
      } else if (shift.shift_type === 'Partido') {
        const winIn2 = checkWindow(shift.start_time_2, shift.entry_start_buffer || 0, shift.entry_end_buffer || 0);
        const winOut2 = checkWindow(shift.end_time_2, shift.exit_start_buffer || 0, shift.exit_end_buffer || 0);
        if (winIn2?.inWindow) {
          type = 'IN';
          const lateLimit = new Date(winIn2.target.getTime() + (travelTolerance * 60000));
          status = markingDate > lateLimit ? 'LateEntry' : 'OnTime';
        } else if (winOut2?.inWindow) {
          type = 'OUT';
          const shiftEndTime = winOut2.target.getTime();
          const toleranceMs = travelTolerance * 60000;
          const earlyLimit = shiftEndTime - toleranceMs;
          const lateLimit = shiftEndTime + toleranceMs;
          if (markingDate.getTime() < earlyLimit) {
            status = 'EarlyDeparture';
          } else if (markingDate.getTime() > lateLimit) {
            status = 'LateDeparture';
          } else {
            status = 'OnTime';
          }
        } else {
          type = 'N/A';
          status = 'NoTurn';
        }
      } else {
        // Si el turno asignado es "Descanso"
        status = 'NoTurn';
        type = r.type || 'N/A';
      }
    } else { // No shift or shift_type is 'Descanso'
      status = 'NoTurn';
      type = r.type || 'N/A';
    }

    // Helper function to calculate geofence validity
    const calculateGeofenceValidity = async (zoneId: string | null, lat: number, lng: number, companyId: string) => {
        // Si no hay ID de zona, o las coordenadas son inválidas/cero, se considera fuera de geocerca.
        if (!zoneId || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            return { isValid: 0, status: 'WrongGeofence' };
        }
        const [zoneRows]: any = await pool.query('SELECT lat, lng, radius, zone_type, bounds FROM marking_zones WHERE id = ? AND company_id = ? AND onDelete = 0 AND is_active = 1', [zoneId, companyId]);
        if (zoneRows[0]) {
            const zone = zoneRows[0];
            let inside = false;
            if (zone.zone_type === 'circle' || !zone.zone_type) {
                const zoneLat = Number(zone.lat || 0);
                const zoneLng = Number(zone.lng || 0);
                const zoneRadius = Number(zone.radius || 0);

                if (zoneLat === 0 && zoneLng === 0 && zoneRadius === 0) { // Datos de zona inválidos
                    return { isValid: 0, status: 'WrongGeofence' };
                }

                const dist = this.calculateDistance(lat, lng, zoneLat, zoneLng);
                inside = dist <= zoneRadius;
            } else {
                const bounds = typeof zone.bounds === 'string' ? JSON.parse(zone.bounds) : zone.bounds;
                if (!bounds || isNaN(Number(bounds.south)) || isNaN(Number(bounds.north)) || isNaN(Number(bounds.west)) || isNaN(Number(bounds.east))) {
                    return { isValid: 0, status: 'WrongGeofence' }; // Datos de límites inválidos
                }
                inside = (lat >= Number(bounds.south) && lat <= Number(bounds.north) && lng >= Number(bounds.west) && lng <= Number(bounds.east));
            }
            return { isValid: inside ? 1 : 0, status: inside ? 'OnTime' : 'WrongGeofence' };
        }
        // Si el ID de zona fue proporcionado pero no se encontró en la base de datos (o está inactivo/borrado)
        return { isValid: 0, status: 'WrongGeofence' }; 
    };

    // 4. Validar Geocerca (Ubicación relativa a la zona seleccionada)
    const geofenceResult = await calculateGeofenceValidity(markingZoneId, finalLat, finalLng, companyId);
    isValidZone = geofenceResult.isValid;

    // Si el estado actual NO es NoTurn, entonces la geocerca puede cambiar el estado
    // Esto asegura que NoTurn tenga prioridad sobre WrongGeofence
    if (status !== 'NoTurn' && geofenceResult.status === 'WrongGeofence') {
        status = 'WrongGeofence';
    }


    // 5. Si sigue sin turno o está en NoTurn, obtener sugerencias del contrato
    let suggestedCostCenter = r.cost_center_id;
    let suggestedMarkingZone = markingZoneId;

    if (status === 'NoTurn' || !r.schedule_id) {
        const [contract]: any = await pool.query(
            `SELECT cost_center_id, marking_zone_id FROM contracts 
             WHERE collaborator_id = ? AND company_id = ? AND status = 'Activo' AND onDelete = 0 
             AND DATE(?) BETWEEN DATE(start_date) AND COALESCE(DATE(end_date), '9999-12-31') LIMIT 1`,
            [collaboratorId, companyId, datePart]
        );
        if (contract[0]) {
            suggestedCostCenter = data.cost_center_id || contract[0].cost_center_id;
            suggestedMarkingZone = data.marking_zone_id || contract[0].marking_zone_id;
        }
    }

    // Retornar análisis permitiendo overrides manuales si vienen en el body
    return { 
      timestamp, 
      type: data.type || type, 
      status: data.status || status, 
      hasExistingSchedule,
      isValidZone, 
      lat: finalLat, 
      lng: finalLng, 
      cost_center_id: suggestedCostCenter,
      marking_zone_id: suggestedMarkingZone,
      shift_id: shift?.id,
      shift_name: shift?.name
    };
  }

  async validateActivityLogEntry(companyId: string, id: string, data: any) {
    const analysis = await this.calculateMarkingAnalysis(companyId, id, data);
    return {
        status: analysis.status,
        type: analysis.type,
        is_valid_zone: analysis.isValidZone,
        has_existing_schedule: analysis.hasExistingSchedule,
        suggested_shift_id: (analysis as any).shift_id || null,
        suggested_shift_name: (analysis as any).shift_name || null,
        suggested_cost_center_id: analysis.cost_center_id,
        suggested_marking_zone_id: analysis.marking_zone_id
    };
  }

  async updateActivityLogEntry(companyId: string, id: string, data: any) {
    // 1. Ejecutar análisis técnico
    const analysis = await this.calculateMarkingAnalysis(companyId, id, data);
    const { timestamp, type, status, isValidZone, lat, lng, cost_center_id, marking_zone_id, hasExistingSchedule } = analysis as any;

    // 2. Obtener el registro para conocer el schedule_id
    const [record]: any = await pool.query('SELECT schedule_id, collaborator_id, DATE(timestamp) as record_date FROM attendance_records WHERE id = ? AND company_id = ?', [id, companyId]);
    let scheduleId = record[0]?.schedule_id;
    const collaboratorId = record[0]?.collaborator_id;
    const recordDate = record[0]?.record_date;

    // 3. Gestión de la vinculación del turno (Schedules)
    if (data.shift_id) {
        // REGLA DE NEGOCIO: Inactivar cualquier otro turno para este día antes de proceder
        await pool.query('UPDATE schedules SET onDelete = 1 WHERE collaborator_id = ? AND DATE(date) = DATE(?) AND company_id = ?', [collaboratorId, recordDate, companyId]);

        if (scheduleId) {
            // Reactivar el schedule_id original con la nueva data
            await pool.query('UPDATE schedules SET shift_id = ?, cost_center_id = COALESCE(?, cost_center_id), onDelete = 0 WHERE id = ? AND company_id = ?', 
                [data.shift_id, cost_center_id, scheduleId, companyId]);
        } else {
            // Buscar si ya existía uno (aunque lo acabemos de marcar onDelete=1 arriba) para re-usar ID
            // Usamos DATE() para evitar conflictos con componentes de tiempo
            const [existing]: any = await pool.query('SELECT id FROM schedules WHERE collaborator_id = ? AND DATE(date) = DATE(?) AND company_id = ? LIMIT 1', [collaboratorId, recordDate, companyId]);
            if (existing.length > 0) {
                scheduleId = existing[0].id;
                await pool.query('UPDATE schedules SET shift_id = ?, cost_center_id = COALESCE(?, cost_center_id), onDelete = 0 WHERE id = ?', [data.shift_id, cost_center_id, scheduleId]);
            } else {
                scheduleId = generateUUID();
                await pool.query('INSERT INTO schedules (id, company_id, collaborator_id, shift_id, date, cost_center_id) VALUES (?, ?, ?, ?, ?, ?)', 
                    [scheduleId, companyId, collaboratorId, data.shift_id, recordDate, cost_center_id]);
            }
        }
    } else if (scheduleId && cost_center_id) {
        // Solo actualizar el centro de costos si ya existe un schedule y reactivarlo
        await pool.query('UPDATE schedules SET cost_center_id = ?, onDelete = 0 WHERE id = ? AND company_id = ?', 
            [cost_center_id, scheduleId, companyId]);
    }

    // 4. Persistencia de cambios en el registro de asistencia (sin incluir cost_center_id que no existe allí)
    const updatePayload: any = {
        timestamp,
        type,
        marking_zone_id: marking_zone_id,
        lat: lat,
        lng: lng,
        status,
        is_valid_zone: isValidZone,
        schedule_id: scheduleId // Asegurar que el marcaje quede vinculado al nuevo schedule
    };

    await this.repository.updateActivityLogEntry(id, updatePayload);

    return { id, status, isValidZone };
  }

  async deleteActivityLogEntry(companyId: string, id: string) {
    // 1. Verificar existencia y pertenencia a la empresa
    const [record]: any = await pool.query(
      'SELECT id FROM attendance_records WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
    
    if (!record || record.length === 0) {
      throw new Error('El registro no existe o no pertenece a su organización');
    }

    // 2. Ejecutar borrado lógico (onDelete = 1)
    await this.repository.updateActivityLogEntry(id, { onDelete: 1 });
    return { success: true };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Radio de la tierra en metros
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const dPhi = (lat2-lat1) * Math.PI/180;
    const dLambda = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(dPhi/2) * Math.sin(dPhi/2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda/2) * Math.sin(dLambda/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
}
