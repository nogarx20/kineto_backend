import { BiometricRepository } from './biometrics.repository';
import { AttendanceService } from '../attendance/attendance.service';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

export class BiometricService {
  private repository = new BiometricRepository();
  private attendanceService = new AttendanceService();

  private readonly DESCRIPTOR_LENGTH = 128;
  private readonly DEFAULT_THRESHOLD = 0.55; 

  private normalizeDescriptor(descriptor: number[]): number[] {
    if (!Array.isArray(descriptor) || descriptor.length !== this.DESCRIPTOR_LENGTH) {
      throw new Error(`Estructura biométrica inválida: se esperan ${this.DESCRIPTOR_LENGTH} dimensiones.`);
    }
    const magnitude = Math.sqrt(descriptor.reduce((sum, v) => sum + v * v, 0));
    if (magnitude === 0) throw new Error('Calidad biométrica insuficiente.');
    return descriptor.map(v => v / magnitude);
  }

  async enroll(companyId: string, collaboratorId: string, rawDescriptor: number[]) {
    const descriptor = this.normalizeDescriptor(rawDescriptor);
    const [collab]: any = await pool.execute(
      'SELECT id FROM collaborators WHERE id = ? AND company_id = ?',
      [collaboratorId, companyId]
    );
    if (!collab.length) throw new Error('Colaborador no encontrado.');
    const id = generateUUID();
    await this.repository.saveTemplate({
      id, company_id: companyId, collaborator_id: collaboratorId, template: descriptor, provider: 'face-api-js-v1'
    });
    return { success: true, message: 'Firma facial registrada.' };
  }

  async delete(companyId: string, collaboratorId: string) {
    await this.repository.deleteTemplate(companyId, collaboratorId);
    return { success: true };
  }

  async identifyAndMark(companyId: string, inputRawDescriptor: number[], coords?: { lat: number, lng: number }) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const inputDescriptor = this.normalizeDescriptor(inputRawDescriptor);
    const [templates]: any = await pool.execute(
      'SELECT b.*, c.identification, c.first_name, c.last_name, c.photo, c.email, c.phone FROM collaborator_biometrics b JOIN collaborators c ON b.collaborator_id = c.id WHERE b.company_id = ? AND c.is_active = 1',
      [companyId] 
    );
    if (!templates.length) throw new Error('No hay firmas faciales registradas en la empresa.');
    let bestMatch: any = null;
    let minDistance = Infinity;
    for (const t of templates) {
      const storedDescriptor = typeof t.biometric_template === 'string' ? JSON.parse(t.biometric_template) : t.biometric_template;
      const distance = this.calculateEuclideanDistance(inputDescriptor, storedDescriptor);
      if (distance < minDistance) { minDistance = distance; bestMatch = t; }
    }
    let threshold = this.DEFAULT_THRESHOLD;
    const [settings]: any = await pool.execute('SELECT settings FROM companies WHERE id = ?', [companyId]);
    if (settings.length && settings[0].settings) {
        const parsed = typeof settings[0].settings === 'string' ? JSON.parse(settings[0].settings) : settings[0].settings;
        threshold = parsed.faceIdThreshold || this.DEFAULT_THRESHOLD;
    }
    if (!bestMatch || minDistance > threshold) throw new Error('Identidad no reconocida. Intente de nuevo.');

    // --- Identificación de Turnos (Hoy y Ayer para Nocturnos) ---
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const [schedules]: any = await pool.execute(
        `SELECT sh.*, s.date as schedule_date, s.id as schedule_id 
         FROM schedules s 
         JOIN shifts sh ON s.shift_id = sh.id 
         WHERE s.collaborator_id = ? AND s.date IN (?, ?) AND s.onDelete = 0
         ORDER BY s.date DESC`, 
        [bestMatch.collaborator_id, yesterdayStr, todayStr]
    );

    let currentShift = null;
    let timeMatch = false;
    let detectedType: 'IN' | 'OUT' | 'N/A' = 'N/A';
    let timeFeedback = "Marcaje fuera de rango";

    for (const s of schedules) {
        if (s.shift_type === 'Descanso') continue;

        // Helper para validar si 'now' cae en la ventana de una hora específica
        const checkWindow = (targetTime: string, before: number, after: number, dateRef: string, dayOffset = 0) => {
            if (!targetTime) return false;
            const [h, m] = targetTime.split(':').map(Number);
            const target = new Date(dateRef + 'T00:00:00'); // Base en la fecha del turno
            target.setHours(h, m, 0, 0);
            if (dayOffset) target.setDate(target.getDate() + dayOffset);
            
            const startLimit = new Date(target.getTime() - (before * 60000));
            const endLimit = new Date(target.getTime() + (after * 60000));
            return now >= startLimit && now <= endLimit;
        };

        const baseDate = s.schedule_date instanceof Date ? s.schedule_date.toISOString().split('T')[0] : s.schedule_date;

        // 1. Entrada Principal
        if (checkWindow(s.start_time, s.entry_start_buffer, s.entry_end_buffer, baseDate)) {
            detectedType = 'IN'; timeMatch = true; timeFeedback = "Entrada"; currentShift = s; break;
        }

        // 2. Salida Principal (Detectar Rollover)
        const isOutRollover = s.end_time < s.start_time ? 1 : 0;
        if (checkWindow(s.end_time, s.exit_start_buffer, s.exit_end_buffer, baseDate, isOutRollover)) {
            detectedType = 'OUT'; timeMatch = true; timeFeedback = isOutRollover ? "Salida (Turno Ayer)" : "Salida"; currentShift = s; break;
        }

        // 3. Turnos Partidos
        if (s.shift_type === 'Partido') {
            const isEntry2Rollover = s.start_time_2 < s.start_time ? 1 : 0;
            if (checkWindow(s.start_time_2, s.entry_start_buffer_2, s.entry_end_buffer_2, baseDate, isEntry2Rollover)) {
                detectedType = 'IN'; timeMatch = true; timeFeedback = "Entrada P2"; currentShift = s; break;
            }
            
            const isOut2Rollover = s.end_time_2 < s.start_time ? 1 : 0;
            if (checkWindow(s.end_time_2, s.exit_start_buffer_2, s.exit_end_buffer_2, baseDate, isOut2Rollover)) {
                detectedType = 'OUT'; timeMatch = true; timeFeedback = "Salida Final"; currentShift = s; break;
            }
        }
    }

    // Si no hubo match de ventana, tomamos el turno de "hoy" (si existe) para mostrar la info en la card roja
    if (!currentShift) {
        currentShift = schedules.find((s: any) => {
            const d = s.schedule_date instanceof Date ? s.schedule_date.toISOString().split('T')[0] : s.schedule_date;
            return d === todayStr;
        }) || null;
    }

    // --- Lógica Geográfica Relacional ---
    let zoneMatch = false;
    let geofenceResults: any[] = [];
    let matchedZoneName = null;

    // Validamos geocerca contra el turno encontrado
    if (currentShift && coords && coords.lat && coords.lat !== 0) {
        const [zones]: any = await pool.query(`
            SELECT mz.name, mz.lat, mz.lng, mz.radius 
            FROM marking_zones mz
            JOIN shift_marking_zones smz ON mz.id = smz.marking_zone_id
            WHERE smz.shift_id = ? AND mz.onDelete = 0 AND mz.is_active = 1
        `, [currentShift.shift_id]);

        geofenceResults = zones.map((z: any) => {
            const dist = this.calculateHaversineDistance(coords.lat, coords.lng, Number(z.lat), Number(z.lng));
            const inside = dist <= Number(z.radius);
            if (inside) { zoneMatch = true; matchedZoneName = z.name; }
            return { name: z.name, isInside: inside, distance: Math.round(dist), radius: z.radius };
        });
    }

    const markingResult = await this.attendanceService.registerMarking(companyId, bestMatch.identification, coords?.lat, coords?.lng);
    await pool.execute('UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ? WHERE id = ?', [bestMatch.id, minDistance, markingResult.id]);

    return { 
        ...markingResult, 
        collaboratorName: `${bestMatch.first_name} ${bestMatch.last_name}`,
        collaboratorInfo: {
            photo: bestMatch.photo,
            email: bestMatch.email,
            phone: bestMatch.phone
        },
        confidence: (1 - minDistance).toFixed(4), 
        match: true,
        type: detectedType, 
        time_feedback: timeFeedback,
        shift: currentShift ? {
            id: currentShift.id,
            name: currentShift.name,
            prefix: currentShift.prefix,
            start_time: currentShift.start_time,
            end_time: currentShift.end_time,
            start_time_2: currentShift.start_time_2,
            end_time_2: currentShift.end_time_2,
            shift_type: currentShift.shift_type,
            // Incluimos buffers para mostrar en el frontend el rango permitido
            entry_start_buffer: currentShift.entry_start_buffer,
            entry_end_buffer: currentShift.entry_end_buffer,
            exit_start_buffer: currentShift.exit_start_buffer,
            exit_end_buffer: currentShift.exit_end_buffer
        } : null,
        validation: {
            has_schedule: !!currentShift, // Indica si existe turno hoy
            shift_match: timeMatch,
            zone_match: currentShift ? zoneMatch : false
        },
        geofence_results: geofenceResults,
        zone_name: matchedZoneName || (geofenceResults.length > 0 ? 'Fuera de Cobertura' : 'Sin Zona'),
        lat: coords?.lat,
        lng: coords?.lng
    };
  }

  async verifyAndMark(companyId: string, identification: string, inputRawDescriptor: number[], coords?: { lat: number, lng: number }) {
    const inputDescriptor = this.normalizeDescriptor(inputRawDescriptor);
    const [collab]: any = await pool.execute('SELECT id, is_active FROM collaborators WHERE identification = ? AND company_id = ?', [identification, companyId]);
    if (!collab.length) throw new Error('Identidad no reconocida.');
    if (!collab[0].is_active) throw new Error('Usuario inactivo.');
    const storedBio = await this.repository.getTemplateByCollaborator(companyId, collab[0].id);
    if (!storedBio) throw new Error('No se ha registrado una firma facial.');
    const storedDescriptor = typeof storedBio.biometric_template === 'string' ? JSON.parse(storedBio.biometric_template) : storedBio.biometric_template;
    const distance = this.calculateEuclideanDistance(inputDescriptor, storedDescriptor);
    let threshold = this.DEFAULT_THRESHOLD;
    const [settings]: any = await pool.execute('SELECT settings FROM companies WHERE id = ?', [companyId]);
    if (settings.length && settings[0].settings) {
        const parsed = typeof settings[0].settings === 'string' ? JSON.parse(settings[0].settings) : settings[0].settings;
        threshold = parsed.faceIdThreshold || this.DEFAULT_THRESHOLD;
    }
    if (distance > threshold) throw new Error('Validación Biométrica Fallida.');
    const markingResult = await this.attendanceService.registerMarking(companyId, identification, coords?.lat, coords?.lng);
    await pool.execute('UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ? WHERE id = ?', [storedBio.id, distance, markingResult.id]);
    return { ...markingResult, confidence: (1 - distance).toFixed(4), match: true };
  }

  private calculateEuclideanDistance(v1: number[], v2: number[]): number {
    return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
  }

  // --- GESTIÓN DE HUELLAS DACTILARES ---
  async enrollFinger(companyId: string, collaboratorId: string, fingerName: string, template: any, deviceInfo?: any) {
    const id = generateUUID();
    await this.repository.saveFingerprint({
      id,
      company_id: companyId,
      collaborator_id: collaboratorId,
      finger_name: fingerName,
      template,
      device_info: deviceInfo
    });
    return { success: true, message: `Huella del ${fingerName} registrada exitosamente.` };
  }

  async getFingers(companyId: string, collaboratorId: string) {
    return await this.repository.getFingersByCollaborator(companyId, collaboratorId);
  }

  async deleteFinger(companyId: string, id: string) {
    await this.repository.deleteFingerprint(companyId, id);
    return { success: true };
  }

  private calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la tierra en metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
