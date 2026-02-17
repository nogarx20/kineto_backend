import { AttendanceRepository } from './attendance.repository';
import { ShiftRepository } from '../shifts/shifts.repository';
import { generateUUID } from '../../utils/uuid';

export class AttendanceService {
  private repository = new AttendanceRepository();
  private shiftRepository = new ShiftRepository();

  async registerMarking(companyId: string, identification: string, lat?: number, lng?: number, method: 'FACE' | 'FINGER' | 'PIN' = 'FACE', pin?: string) {
    // 1. Identificar colaborador
    let collaborator;
    if (method === 'PIN') {
      if (!pin) throw new Error('Se requiere el PIN de seguridad.');
      collaborator = await this.repository.findCollaboratorByIdAndPin(companyId, identification, pin);
      if (!collaborator) throw new Error('Identificación o PIN incorrectos.');
    } else {
      collaborator = await this.repository.findCollaboratorByIdentification(companyId, identification);
    }
    
    if (!collaborator) throw new Error('Identificación no encontrada en el sistema.');

    if (!(collaborator.is_active == 1 || collaborator.is_active === true)) {
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

    if (lat !== undefined && lng !== undefined && lat !== null && lng !== null) {
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
                // Si el turno tiene una zona específica, validamos contra esa. Si no, cualquier zona de la empresa vale.
                if (schedule?.marking_zone_id) {
                    if (schedule.marking_zone_id === zone.id) isValidZone = true;
                } else {
                    isValidZone = true;
                }
                break;
            }
        }
    } else {
        // Si no hay coordenadas, por defecto marcamos como fuera de zona si se requiere geocerca, 
        // o permitimos si la empresa no restringe. Para este caso asumiremos que sin GPS no es válida si hay zonas.
        isValidZone = false; 
    }

    // 6. Calcular estado puntualidad
    let status = 'OnTime';
    if (schedule && type === 'IN') {
        const now = new Date();
        const [hours, minutes] = schedule.start_time.split(':');
        
        // El buffer de entrada (tardía permitida)
        const entryLimit = new Date();
        entryLimit.setHours(parseInt(hours), parseInt(minutes), 0);
        entryLimit.setMinutes(entryLimit.getMinutes() + (schedule.entry_end_buffer || 15));
        
        status = now > entryLimit ? 'Late' : 'OnTime';
    } else if (!schedule) {
        status = 'Unknown'; // Marcaje sin turno programado
    }

    // 7. Guardar marcaje
    const id = generateUUID();
    await this.repository.createRecord({
        id,
        company_id: companyId,
        collaborator_id: collaborator.id,
        schedule_id: schedule?.id || null,
        type,
        lat: lat ?? null,
        lng: lng ?? null,
        marking_zone_id: markingZoneId,
        is_valid_zone: isValidZone,
        status,
        biometric_method: method
    });

    return { 
        id, 
        type, 
        status, 
        collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`,
        time: new Date(),
        shiftName: schedule?.shift_name || 'Sin Turno',
        validation: {
            shift_match: status === 'OnTime' || status === 'Unknown',
            zone_match: isValidZone,
            has_schedule: !!schedule
        }
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la tierra en metros
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
