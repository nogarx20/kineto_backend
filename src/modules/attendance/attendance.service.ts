
import { AttendanceRepository } from './attendance.repository';
import { ShiftRepository } from '../shifts/shifts.repository';
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
      type?: 'IN' | 'OUT' | 'N/A',
      status?: string,
      markingZoneId?: string | null,
      isValidZone?: boolean
    }
  ) {
    const { identification, lat, lng } = data;
    // 1. Identificar colaborador
    const collaborator = await this.repository.findCollaboratorByIdentification(companyId, identification);
    if (!collaborator) throw new Error('Identificación no encontrada en el sistema.');

    if (!collaborator.is_active) {
        throw new Error('El perfil del colaborador se encuentra inhabilitado.');
    }

    // 2. Verificar Contrato Activo
    const activeContract = await this.repository.findActiveContract(collaborator.id, companyId);
    if (!activeContract) {
        throw new Error('Acceso Denegado: No se detectó un contrato laboral activo para este colaborador.');
    }

    let type = data.type;
    let scheduleId = data.scheduleId;
    let status = data.status || 'Unknown';
    let markingZoneId = data.markingZoneId;
    let isValidZone = data.isValidZone;

    // 3. Determinar tipo (IN/OUT) si no viene pre-validado
    if (type === undefined) {
        const records = await this.repository.findTodayRecords(companyId, collaborator.id);
        const lastRecord = records[0];
        type = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';
    }

    // 4. Buscar programación si no viene pre-validada
    let schedule = null;
    if (scheduleId === undefined) {
        schedule = await this.repository.findTodaySchedule(companyId, collaborator.id);
        scheduleId = schedule?.id || null;
    }
    
    // 5. Validar Geovalla
    if (markingZoneId === undefined && isValidZone === undefined) {
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

    // 6. Calcular estado puntualidad
    if (status === 'Unknown' && scheduleId && type === 'IN') {
        const targetSchedule = schedule || await this.repository.findTodaySchedule(companyId, collaborator.id);
        if (targetSchedule && targetSchedule.start_time) {
            const now = new Date();
            const [hours, minutes] = targetSchedule.start_time.split(':');
        const entryTime = new Date();
        entryTime.setHours(parseInt(hours), parseInt(minutes), 0);
            entryTime.setMinutes(entryTime.getMinutes() + (targetSchedule.entry_buffer_minutes || 0));
        
        status = now > entryTime ? 'Late' : 'OnTime';
        }
    }

    // 7. Guardar marcaje
    const id = generateUUID();
    await this.repository.createRecord({
        id,
        company_id: companyId,
        collaborator_id: collaborator.id,
        schedule_id: scheduleId,
        type,
        lat,
        lng,
        marking_zone_id: markingZoneId,
        is_valid_zone: isValidZone,
        status
    });

    return { 
        id, 
        type, 
        status, 
        collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`,
        time: new Date() 
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
}
