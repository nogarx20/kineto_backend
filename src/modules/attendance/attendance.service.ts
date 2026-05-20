
import { AttendanceRepository } from './attendance.repository';
import { ShiftRepository } from '../shifts/shifts.repository';
import { ShiftService } from '../shifts/shifts.service';
import { generateUUID } from '../../utils/uuid';

export class AttendanceService {
  private repository = new AttendanceRepository();
  private shiftRepository = new ShiftRepository();

  async registerMarking(
    companyId: string, 
    data: { 
      identification: string, 
      lat?: number, 
      lng?: number,
      scheduleId?: string | null,
      type?: 'IN' | 'OUT' | 'N/A' | undefined,
      status?: string,
      markingZoneId?: string | null,
      isValidZone?: boolean
    }
  ) {
    console.log(`[AttendanceService] registerMarking called for identification: ${data.identification}, type: ${data.type}, initial status: ${data.status}`);
    const { identification, lat, lng } = data;
    // 1. Identificar colaborador
    const collaborator = await this.repository.findCollaboratorByIdentification(companyId, identification);
    if (!collaborator) throw new Error('Identificación no encontrada en el sistema.');

    if (!collaborator.is_active) {
        throw new Error('El perfil del colaborador se encuentra inhabilitado.');
    }

    const [schedulingParams, companySettings] = await Promise.all([
        this.repository.getSchedulingParameters(companyId),
        this.repository.getCompanySettings(companyId)
    ]);

    const tolerance = parseInt(companySettings.travelTolerance) || 0;
    const type: 'IN' | 'OUT' | 'N/A' = data.type || 'N/A';
    let scheduleId = data.scheduleId;
    let status = data.status || 'Unknown';
    let markingZoneId = data.markingZoneId;
    let isValidZone = data.isValidZone ?? false;

    const now = new Date();
    const roundedMarkingTime = this.roundTime(now, schedulingParams.rounding_minutes || 0);

    // --- PASO 1: RECONOCIMIENTO (Validado previamente por BiometricService) ---
    if (status === 'NoRecognition') {
        const id = generateUUID();
        await this.repository.createRecord({
            id,
            company_id: companyId,
            collaborator_id: collaborator.id,
            schedule_id: null,
            type: 'N/A',
            lat,
            lng,
            status: 'NoRecognition'
        });
        return { id, type: 'N/A', status: 'NoRecognition', collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, time: roundedMarkingTime.toISOString() };
    }

    // --- PASO 2: ASIGNACIÓN DE TURNO ---
    let schedule = null;
    if (!scheduleId) {
        schedule = await this.repository.findTodaySchedule(companyId, collaborator.id);
        scheduleId = schedule?.id || null;
    }
    
    if (!scheduleId) {
        const id = generateUUID();
        await this.repository.createRecord({
            id,
            company_id: companyId,
            collaborator_id: collaborator.id,
            schedule_id: null,
            type: 'N/A',
            lat,
            lng,
            marking_zone_id: null,
            is_valid_zone: false,
            status: 'NoTurn'
        });
        return { id, type: 'N/A', status: 'NoTurn', collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, time: roundedMarkingTime.toISOString() };
    }
    
    // --- PASO 3: GEOVALLA ---
    // Si el biometricService no envió validación de zona, la hacemos aquí
    if (data.isValidZone === undefined) {
        markingZoneId = null;
        isValidZone = false;
        if (lat && lng) {
        const zones = await this.shiftRepository.findAllZones(companyId);
        for (const zone of zones) {
            let isInside = false;

            if (zone.zone_type === 'circle' || !zone.zone_type) {
                const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
                isInside = distance <= zone.radius;
            } else if (zone.zone_type === 'rectangle' || zone.zone_type === 'square') {
                const bounds = typeof zone.bounds === 'string' ? JSON.parse(zone.bounds) : zone.bounds;
                if (bounds) {
                    isInside = (
                        lat >= bounds.south && lat <= bounds.north &&
                        lng >= bounds.west && lng <= bounds.east
                    );
                }
            }

            if (isInside) {
                markingZoneId = zone.id;
                if (schedule?.marking_zone_id) {
                    if (schedule.marking_zone_id === zone.id) isValidZone = true;
                } else {
                    isValidZone = true;
                }
                break;
            }
        }
        } else {
            isValidZone = true; 
        }
    }

    // --- PASO 3: GEOVALLA (Retorno temprano si falla) ---
    if (!isValidZone) {
        const id = generateUUID();
        await this.repository.createRecord({
            id,
            company_id: companyId,
            collaborator_id: collaborator.id,
            schedule_id: scheduleId,
            type: 'N/A',
            lat,
            lng,
            marking_zone_id: markingZoneId,
            is_valid_zone: false,
            status: 'WrongGeofence'
        });
        return { id, type: 'N/A', status: 'WrongGeofence', collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, time: roundedMarkingTime.toISOString() };
    }

    // 6. Calcular estado puntualidad
    if (status === 'Unknown' && scheduleId) {
        const targetSchedule = schedule || await this.repository.findTodaySchedule(companyId, collaborator.id);
        if (targetSchedule) {
            // Obtener la fecha local de la operación (Colombia) para evitar saltos de día por UTC
            const dateRef = roundedMarkingTime.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
            const shiftStartTime = new Date(`${dateRef}T${targetSchedule.start_time}-05:00`);
            const shiftEndTime = new Date(`${dateRef}T${targetSchedule.end_time}-05:00`);

            // Ajustar shiftEndTime si el turno cruza la medianoche
            if (shiftEndTime < shiftStartTime) {
                shiftEndTime.setDate(shiftEndTime.getDate() + 1);
            }

            if (type === 'IN') {
                const entryWindowStart = new Date(shiftStartTime.getTime() - (tolerance * 60 * 1000));
                const entryWindowEnd = new Date(shiftStartTime.getTime() + (tolerance * 60 * 1000));

                if (roundedMarkingTime < entryWindowStart) {
                    status = 'EarlyEntry';
                } else if (roundedMarkingTime > entryWindowEnd) {
                    status = 'LateEntry';
                } else {
                    status = 'OnTime';
                }
            } else if (type === 'OUT') {
                const exitWindowStart = new Date(shiftEndTime.getTime() - (tolerance * 60 * 1000));
                const exitWindowEnd = new Date(shiftEndTime.getTime() + (tolerance * 60 * 1000));

                if (roundedMarkingTime < exitWindowStart) {
                    status = 'EarlyDeparture';
                } else if (roundedMarkingTime > exitWindowEnd) {
                    status = 'LateDeparture';
                } else {
                    status = 'OnTime';
                }
            }
        }
    }

    // 7. Guardar marcaje
    // Asegurarse de que el timestamp guardado sea el redondeado
    const id = generateUUID();
    console.log(`[AttendanceService] Creating record with ID: ${id}, final status: ${status}`);
    await this.repository.createRecord({
        id,
        company_id: companyId,
        collaborator_id: collaborator.id,
        schedule_id: scheduleId,
        type,
        lat, // Se mantiene el lat/lng original para trazabilidad
        lng, // Se mantiene el lat/lng original para trazabilidad
        marking_zone_id: markingZoneId,
        is_valid_zone: isValidZone,
        status
    }); // This is the only place createRecord is called
    console.log(`[AttendanceService] Record ${id} created successfully.`);

    return { 
        id, 
        type, 
        status, 
        collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, // Se devuelve el nombre completo
        time: roundedMarkingTime.toISOString() // Se devuelve la hora redondeada
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  async getAttendanceRecordsBySchedule(companyId: string, scheduleId: string) {
    return await this.repository.findByScheduleId(companyId, scheduleId);
  }

  private roundTime(date: Date, minutes: number): Date {
    if (!minutes || minutes <= 0) return new Date(date);
    const ms = 1000 * 60 * minutes;
    const rounded = new Date(Math.round(date.getTime() / ms) * ms);
    return rounded;
  }

}
