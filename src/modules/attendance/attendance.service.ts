
import { AttendanceRepository } from './attendance.repository';
import { ShiftRepository } from '../shifts/shifts.repository';
import { generateUUID } from '../../utils/uuid';

export class AttendanceService {
  private repository = new AttendanceRepository();
  private shiftRepository = new ShiftRepository();

  async registerMarking(companyId: string, identification: string, lat?: number, lng?: number) {
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

    // 3. Determinar tipo (IN/OUT)
    const records = await this.repository.findTodayRecords(companyId, collaborator.id);
    const lastRecord = records[0];
    const type = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';

    // 4. Buscar programación
    const schedule = await this.repository.findTodaySchedule(companyId, collaborator.id);
    
    // 5. Validar Geovalla
    let markingZoneId = null;
    let isValidZone = false;

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

    // 6. Calcular estado puntualidad
    let status = 'Unknown';
    if (schedule && type === 'IN') {
        const now = new Date();
        const [hours, minutes] = schedule.start_time.split(':');
        const entryTime = new Date();
        entryTime.setHours(parseInt(hours), parseInt(minutes), 0);
        entryTime.setMinutes(entryTime.getMinutes() + schedule.entry_buffer_minutes);
        
        status = now > entryTime ? 'Late' : 'OnTime';
    }

    // 7. Guardar marcaje
    const id = generateUUID();
    await this.repository.createRecord({
        id,
        company_id: companyId,
        collaborator_id: collaborator.id,
        schedule_id: schedule?.id || null,
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
}
