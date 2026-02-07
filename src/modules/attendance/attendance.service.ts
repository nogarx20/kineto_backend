
import { AttendanceRepository } from './attendance.repository';
import { ShiftRepository } from '../shifts/shifts.repository'; // Reutilizamos para traer zonas
import { generateUUID } from '../../utils/uuid';

export class AttendanceService {
  private repository = new AttendanceRepository();
  private shiftRepository = new ShiftRepository();

  async registerMarking(companyId: string, identification: string, lat?: number, lng?: number) {
    // 1. Identificar colaborador
    const collaborator = await this.repository.findCollaboratorByIdentification(companyId, identification);
    if (!collaborator) throw new Error('Identificación no encontrada');

    // 2. Determinar si es Entrada o Salida basado en el último registro
    const records = await this.repository.findTodayRecords(companyId, collaborator.id);
    const lastRecord = records[0];
    const type = (!lastRecord || lastRecord.type === 'OUT') ? 'IN' : 'OUT';

    // 3. Buscar turno programado
    const schedule = await this.repository.findTodaySchedule(companyId, collaborator.id);
    
    // 4. Validar Geocerca (si se proporcionan coordenadas y hay turno con zona asignada)
    let markingZoneId = null;
    let isValidZone = false; // Por defecto inválido si se requiere zona y no se cumple

    if (lat && lng) {
        // Verificar contra todas las zonas de la empresa o la del turno específico
        const zones = await this.shiftRepository.findAllZones(companyId);
        
        for (const zone of zones) {
            const distance = this.calculateDistance(lat, lng, zone.lat, zone.lng);
            if (distance <= zone.radius) {
                markingZoneId = zone.id;
                // Si el turno requiere una zona específica, validamos que sea esa
                if (schedule?.marking_zone_id) {
                    if (schedule.marking_zone_id === zone.id) isValidZone = true;
                } else {
                    isValidZone = true; // Si no tiene zona específica, cualquier zona de la empresa vale
                }
                break; // Encontró zona válida
            }
        }
    } else {
        // Si no hay GPS, asumimos manual/biométrico en sitio físico (hardware)
        // O marcamos inválido si la política lo exige. Para este demo:
        isValidZone = true; 
    }

    // 5. Calcular estado (Late, OnTime) - Simplificado
    let status = 'Unknown';
    if (schedule && type === 'IN') {
        const now = new Date();
        const [hours, minutes] = schedule.start_time.split(':');
        const entryTime = new Date();
        entryTime.setHours(parseInt(hours), parseInt(minutes), 0);
        
        // Margen
        entryTime.setMinutes(entryTime.getMinutes() + schedule.entry_buffer_minutes);
        
        if (now > entryTime) status = 'Late';
        else status = 'OnTime';
    }

    // 6. Guardar
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

  // Haversine formula para distancia en metros
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Metros
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
