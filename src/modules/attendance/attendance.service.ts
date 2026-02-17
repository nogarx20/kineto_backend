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

    // 2. Verificar Contrato Activo (Regla crítica de nómina)
    const activeContract = await this.repository.findActiveContract(collaborator.id, companyId);
    if (!activeContract) {
        throw new Error('Acceso Denegado: No se detectó un contrato laboral activo para este colaborador.');
    }

    // 3. Determinar tipo (IN/OUT)
    const records = await this.repository.findTodayRecords(companyId, collaborator.id);
    const lastRecord = records[0];
    const type = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';

    // 4. Buscar programación del día actual
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
                // Si el turno exige una zona específica, validamos contra esa. Si no, cualquier zona corporativa es válida.
                if (schedule?.marking_zone_id) {
                    if (schedule.marking_zone_id === zone.id) isValidZone = true;
                } else {
                    isValidZone = true;
                }
                break;
            }
        }
    } else {
        // Si no hay coordenadas, se marca como inválido por defecto en sistemas de alta seguridad
        isValidZone = false; 
    }

    // 6. Validar Turno (Horario y Punctualidad)
    let status = 'Unknown';
    let isWithinShift = false;

    if (schedule) {
        const now = new Date();
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

        // Parsear horarios del turno
        const [startH, startM] = schedule.start_time.split(':').map(Number);
        const [endH, endM] = schedule.end_time.split(':').map(Number);
        
        const startTimeMinutes = startH * 60 + startM;
        const endTimeMinutes = endH * 60 + endM;

        // Búferes
        const entryStart = startTimeMinutes - (schedule.entry_start_buffer || 15);
        const entryEnd = startTimeMinutes + (schedule.entry_end_buffer || 15);
        const exitStart = endTimeMinutes - (schedule.exit_start_buffer || 15);
        const exitEnd = endTimeMinutes + (schedule.exit_end_buffer || 15);

        if (type === 'IN') {
            isWithinShift = currentTimeMinutes >= entryStart && currentTimeMinutes <= entryEnd;
            status = now.getTime() > (new Date().setHours(startH, startM + (schedule.entry_end_buffer || 0), 0)) ? 'Late' : 'OnTime';
        } else {
            isWithinShift = currentTimeMinutes >= exitStart && currentTimeMinutes <= exitEnd;
            status = 'OnTime'; // Salida no suele marcarse como Late a menos que haya reglas de horas mínimas
        }
    }

    // 7. Guardar marcaje (Siempre se guarda para trazabilidad, informando desviaciones)
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
        time: new Date(),
        validation: {
            shift_match: !!schedule && isWithinShift,
            zone_match: isValidZone,
            has_schedule: !!schedule
        }
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
