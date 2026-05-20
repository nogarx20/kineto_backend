import { BiometricRepository } from './biometrics.repository';
import { AttendanceService } from '../attendance/attendance.service';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

export class BiometricService {
  private repository = new BiometricRepository();
  private attendanceService = new AttendanceService();

  private readonly DESCRIPTOR_LENGTH = 128;
  private readonly DEFAULT_THRESHOLD = 0.55; 

  // Asumimos que AttendanceService.registerMarking tiene la siguiente firma:
  // registerMarking(
  //   companyId: string,
  //   identification: string,
  //   lat?: number,
  //   lng?: number,
  //   scheduleId?: string | null,
  //   type?: 'IN' | 'OUT' | 'N/A',
  //   status?: string,
  //   markingZoneId?: string | null,
  //   isValidZone?: boolean
  // ): Promise<any>;
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
      `SELECT b.*, c.identification, c.first_name, c.last_name, c.photo, c.email, c.phone, 
              (SELECT position_name FROM contracts WHERE collaborator_id = c.id AND onDelete = 0 AND status = 'Activo' LIMIT 1) as position_name
       FROM collaborator_biometrics b 
       JOIN collaborators c ON b.collaborator_id = c.id 
       WHERE b.company_id = ? AND c.is_active = 1`,
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
        `SELECT 
            sh.id, sh.name, sh.prefix, sh.start_time, sh.end_time, sh.start_time_2, sh.end_time_2, 
            sh.shift_type, sh.entry_start_buffer, sh.entry_end_buffer, sh.exit_start_buffer, sh.exit_end_buffer,
            s.date as schedule_date, s.id as schedule_id, s.marking_zone_id 
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
            
            // Forzamos la creación de la fecha en la zona horaria de Colombia (-05:00)
            // Esto garantiza que la comparación sea correcta independientemente de la zona horaria del servidor.
            const target = new Date(`${dateRef}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00-05:00`);
            
            if (dayOffset) target.setDate(target.getDate() + dayOffset);
            
            const startLimit = new Date(target.getTime() - (before * 60000));
            const endLimit = new Date(target.getTime() + (after * 60000));
            return now >= startLimit && now <= endLimit;
        };

        // Extraemos la fecha de forma segura sin que el desfase UTC de toISOString mueva el día
        const baseDate = s.schedule_date instanceof Date 
            ? `${s.schedule_date.getFullYear()}-${(s.schedule_date.getMonth() + 1).toString().padStart(2, '0')}-${s.schedule_date.getDate().toString().padStart(2, '0')}` 
            : s.schedule_date;

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
            const d = s.schedule_date instanceof Date 
                ? `${s.schedule_date.getFullYear()}-${(s.schedule_date.getMonth() + 1).toString().padStart(2, '0')}-${s.schedule_date.getDate().toString().padStart(2, '0')}` 
                : s.schedule_date;
            return d === todayStr;
        }) || null;
    }

    // --- Lógica Geográfica Relacional ---
    let zoneMatch = false; // This will be passed to attendance service as isValidZone
    const geofenceResults: any[] = []; // For frontend feedback
    let matchedZoneName = null; // For frontend feedback
    let assignedZoneName = 'Sin geocerca'; // For frontend feedback

    // Validamos geocerca contra el turno encontrado
    if (currentShift && coords && coords.lat && coords.lat !== 0) {
        if (currentShift.marking_zone_id) {
            const [zones]: any = await pool.query('SELECT name, lat, lng, radius, zone_type, bounds FROM marking_zones WHERE id = ? AND onDelete = 0 AND is_active = 1', [currentShift.marking_zone_id]);
            if (zones.length > 0) {
                const zone = zones[0];
                if (zone.zone_type === 'circle' || !zone.zone_type) {
                    const dist = this.calculateHaversineDistance(coords.lat, coords.lng, Number(zone.lat), Number(zone.lng));
                    zoneMatch = dist <= Number(zone.radius);
                } else if (zone.zone_type === 'rectangle' || zone.zone_type === 'square') {
                    const bounds = typeof zone.bounds === 'string' ? JSON.parse(zone.bounds) : zone.bounds;
                    zoneMatch = (coords.lat >= bounds.south && coords.lat <= bounds.north && coords.lng >= bounds.west && coords.lng <= bounds.east);
                }
                if (zoneMatch) { matchedZoneName = zone.name; }
                assignedZoneName = zone.name;
                geofenceResults.push({ name: zone.name, isInside: zoneMatch, distance: zone.zone_type === 'circle' ? Math.round(this.calculateHaversineDistance(coords.lat, coords.lng, Number(zone.lat), Number(zone.lng))) : null, radius: zone.radius });
            }
        } else {
            // Si no hay geocerca específica asignada en la programación, se permite el marcaje en cualquier lugar
            zoneMatch = true; 
            matchedZoneName = 'Sin restricción geográfica'; 
            assignedZoneName = 'Ubicación Libre';
        }
    }
    // The attendance service will determine the final status (OnTime, Late, EarlyDeparture, EarlyEntry)
    // and also the isValidZone based on the markingZoneIdToPass and lat/lng.
    // We pass the raw data and let attendance.service handle the full validation.

    const markingResult = await this.attendanceService.registerMarking(
        companyId,
        {
            identification: bestMatch.identification,
            lat: coords?.lat,
            lng: coords?.lng,
            scheduleId: currentShift?.schedule_id || null,
            type: detectedType === 'N/A' ? undefined : detectedType,
            status: 'Unknown', // Let attendance service determine the final status
            markingZoneId: currentShift?.marking_zone_id || null,
            isValidZone: zoneMatch
        }
    );
    await pool.execute('UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ?, biometric_method = ?, validation_method = ? WHERE id = ?', [bestMatch.id, minDistance, 'FACE', 'FACE', markingResult.id]);

    return { 
        ...markingResult, 
        collaboratorName: `${bestMatch.first_name} ${bestMatch.last_name}`,
        collaboratorInfo: {
            photo: bestMatch.photo,
            email: bestMatch.email,
            phone: bestMatch.phone,
            position: bestMatch.position_name
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
            zone_match: currentShift ? zoneMatch : false,
            assigned_zone_name: assignedZoneName
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

    // Si falla la biometría, registramos con NoRecognition y salimos
    if (distance > threshold) {
        return await this.attendanceService.registerMarking(companyId, {
            identification,
            lat: coords?.lat,
            lng: coords?.lng,
            status: 'NoRecognition',
            type: 'N/A'
        });
    }

    const markingResult = await this.attendanceService.registerMarking(
      companyId,
      {
        identification: identification,
        lat: coords?.lat,
        lng: coords?.lng,
        scheduleId: null,
        type: 'N/A',
        status: 'Unknown',
        markingZoneId: null,
        isValidZone: false
      }
    );

    await pool.execute(
        'UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ?, biometric_method = ?, validation_method = ? WHERE id = ?',
        [storedBio.id, distance, 'FACE', 'FACE', markingResult.id]
    );

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

  async verifyPinAndMark(companyId: string, pin: string, coords?: { lat: number, lng: number }) {
    // 1. Buscar colaborador por PIN
    const [collaborators]: any = await pool.execute(
      `SELECT c.id, c.identification, c.first_name, c.last_name, c.photo, c.email, c.phone, 
              (SELECT position_name FROM contracts WHERE collaborator_id = c.id AND onDelete = 0 AND status = 'Activo' LIMIT 1) as position_name 
       FROM collaborators c WHERE c.pin = ? AND c.company_id = ? AND c.is_active = 1`,
      [pin, companyId]
    );

    if (collaborators.length === 0) {
      throw new Error('PIN no reconocido o colaborador inactivo.');
    }
    if (collaborators.length > 1) {
      // Esto no debería pasar si el PIN es único, pero es una buena práctica
      throw new Error('Múltiples colaboradores encontrados con el mismo PIN. Contacte a soporte.');
    }
    const collaborator = collaborators[0];

    // --- Identificación de Turnos (Identidad de lógica con Face ID) ---
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const [schedules]: any = await pool.execute(
        `SELECT 
            sh.id, sh.name, sh.prefix, sh.start_time, sh.end_time, sh.start_time_2, sh.end_time_2, 
            sh.shift_type, sh.entry_start_buffer, sh.entry_end_buffer, sh.exit_start_buffer, sh.exit_end_buffer,
            s.date as schedule_date, s.id as schedule_id, s.marking_zone_id 
         FROM schedules s 
         JOIN shifts sh ON s.shift_id = sh.id 
         WHERE s.collaborator_id = ? AND s.date IN (?, ?) AND s.onDelete = 0
         ORDER BY s.date DESC`, 
        [collaborator.id, yesterdayStr, todayStr]
    );

    let currentShift = null;
    let timeMatch = false;
    let detectedType: 'IN' | 'OUT' | 'N/A' = 'N/A';
    let timeFeedback = "Marcaje fuera de rango";

    for (const s of schedules) {
        if (s.shift_type === 'Descanso') continue;

        const checkWindow = (targetTime: string, before: number, after: number, dateRef: string, dayOffset = 0) => {
            if (!targetTime) return false;
            const [h, m] = targetTime.split(':').map(Number);
            const target = new Date(`${dateRef}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00-05:00`);
            if (dayOffset) target.setDate(target.getDate() + dayOffset);
            const startLimit = new Date(target.getTime() - (before * 60000));
            const endLimit = new Date(target.getTime() + (after * 60000));
            return now >= startLimit && now <= endLimit;
        };

        const baseDate = s.schedule_date instanceof Date 
            ? `${s.schedule_date.getFullYear()}-${(s.schedule_date.getMonth() + 1).toString().padStart(2, '0')}-${s.schedule_date.getDate().toString().padStart(2, '0')}` 
            : s.schedule_date;

        if (checkWindow(s.start_time, s.entry_start_buffer, s.entry_end_buffer, baseDate)) {
            detectedType = 'IN'; timeMatch = true; timeFeedback = "Entrada"; currentShift = s; break;
        }
        const isOutRollover = s.end_time < s.start_time ? 1 : 0;
        if (checkWindow(s.end_time, s.exit_start_buffer, s.exit_end_buffer, baseDate, isOutRollover)) {
            detectedType = 'OUT'; timeMatch = true; timeFeedback = isOutRollover ? "Salida (Turno Ayer)" : "Salida"; currentShift = s; break;
        }
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

    if (!currentShift) {
        currentShift = schedules.find((s: any) => {
            const d = s.schedule_date instanceof Date 
                ? `${s.schedule_date.getFullYear()}-${(s.schedule_date.getMonth() + 1).toString().padStart(2, '0')}-${s.schedule_date.getDate().toString().padStart(2, '0')}` 
                : s.schedule_date;
            return d === todayStr;
        }) || null;
    }

    // --- Lógica Geográfica Relacional ---
    let zoneMatch = false;
    const geofenceResults: any[] = [];
    let matchedZoneName = null;
    let assignedZoneName = 'Sin geocerca';

    if (currentShift && coords && coords.lat && coords.lat !== 0) {
        if (currentShift.marking_zone_id) {
            const [zones]: any = await pool.query('SELECT name, lat, lng, radius, zone_type, bounds FROM marking_zones WHERE id = ? AND onDelete = 0 AND is_active = 1', [currentShift.marking_zone_id]);
            if (zones.length > 0) {
                const zone = zones[0];
                if (zone.zone_type === 'circle' || !zone.zone_type) {
                    const dist = this.calculateHaversineDistance(coords.lat, coords.lng, Number(zone.lat), Number(zone.lng));
                    zoneMatch = dist <= Number(zone.radius);
                } else if (zone.zone_type === 'rectangle' || zone.zone_type === 'square') {
                    const bounds = typeof zone.bounds === 'string' ? JSON.parse(zone.bounds) : zone.bounds;
                    zoneMatch = (coords.lat >= bounds.south && coords.lat <= bounds.north && coords.lng >= bounds.west && coords.lng <= bounds.east);
                }
                if (zoneMatch) { matchedZoneName = zone.name; }
                assignedZoneName = zone.name;
                geofenceResults.push({ name: zone.name, isInside: zoneMatch, distance: zone.zone_type === 'circle' ? Math.round(this.calculateHaversineDistance(coords.lat, coords.lng, Number(zone.lat), Number(zone.lng))) : null, radius: zone.radius });
            }
        } else {
            zoneMatch = true; 
            matchedZoneName = 'Sin restricción geográfica'; 
            assignedZoneName = 'Ubicación Libre';
        }
    }

    const markingResult = await this.attendanceService.registerMarking(
      companyId,
      { 
          identification: collaborator.identification, 
          lat: coords?.lat, 
          lng: coords?.lng, 
          scheduleId: currentShift?.schedule_id || null,
          type: detectedType === 'N/A' ? undefined : detectedType,
          status: 'Unknown',
          markingZoneId: currentShift?.marking_zone_id || null,
          isValidZone: zoneMatch
      }
    );

    // Actualizar con método PIN
    await pool.execute(
        'UPDATE attendance_records SET biometric_method = ?, validation_method = ? WHERE id = ?',
        ['PIN', 'PIN', markingResult.id]
    );

    return { 
        ...markingResult, 
        collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, 
        collaboratorInfo: {
            photo: collaborator.photo,
            email: collaborator.email,
            phone: collaborator.phone,
            position: collaborator.position_name
        }, 
        confidence: "1.0000",
        match: true,
        type: detectedType,
        time_feedback: timeFeedback,
        shift: currentShift ? {
            id: currentShift.id,
            name: currentShift.name,
            prefix: currentShift.prefix,
            start_time: currentShift.start_time,
            end_time: currentShift.end_time,
            shift_type: currentShift.shift_type,
            entry_start_buffer: currentShift.entry_start_buffer,
            entry_end_buffer: currentShift.entry_end_buffer,
            exit_start_buffer: currentShift.exit_start_buffer,
            exit_end_buffer: currentShift.exit_end_buffer
        } : null,
        validation: {
            has_schedule: !!currentShift,
            shift_match: timeMatch,
            zone_match: currentShift ? zoneMatch : false,
            assigned_zone_name: assignedZoneName
        },
        geofence_results: geofenceResults,
        zone_name: matchedZoneName || (geofenceResults.length > 0 ? 'Fuera de Cobertura' : 'Sin Zona'),
        lat: coords?.lat,
        lng: coords?.lng
    };
  }

  async verifyFingerAndMark(companyId: string, template: any, coords?: { lat: number, lng: number }) {
    // 1. Buscar coincidencia de huella en la base de datos de la empresa
    // En una implementación real, se usaría un motor de comparación 1:N del fabricante.
    const [fingerprints]: any = await pool.execute(
      `SELECT f.collaborator_id, f.biometric_template, c.identification, c.first_name, c.last_name, c.photo, c.email, c.phone,
              (SELECT position_name FROM contracts WHERE collaborator_id = c.id AND onDelete = 0 AND status = 'Activo' LIMIT 1) as position_name 
       FROM collaborator_fingerprints f
       JOIN collaborators c ON f.collaborator_id = c.id
       WHERE f.company_id = ? AND c.is_active = 1`,
      [companyId]
    );

    // Simulamos una comparación exitosa con el primer registro para fines de esta implementación
    // Aquí deberías integrar la lógica de comparación del SDK (ej: fingerprint.compare(input, stored))
    if (fingerprints.length === 0) {
      throw new Error('No se encontraron huellas registradas o el lector no devolvió datos válidos.');
    }

    const match = fingerprints[0]; // Tomamos el primer match simulado
    const collaborator = match;

    // --- Identificación de Turnos (Lógica idéntica a Face/PIN) ---
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    const [schedules]: any = await pool.execute(
        `SELECT sh.id, sh.name, sh.prefix, sh.start_time, sh.end_time, sh.start_time_2, sh.end_time_2, 
                sh.shift_type, sh.entry_start_buffer, sh.entry_end_buffer, sh.exit_start_buffer, sh.exit_end_buffer,
                s.date as schedule_date, s.id as schedule_id, s.marking_zone_id 
         FROM schedules s 
         JOIN shifts sh ON s.shift_id = sh.id 
         WHERE s.collaborator_id = ? AND s.date IN (?, ?) AND s.onDelete = 0
         ORDER BY s.date DESC`, 
        [collaborator.collaborator_id, yesterdayStr, todayStr]
    );

    let currentShift = null;
    let timeMatch = false;
    let detectedType: 'IN' | 'OUT' | 'N/A' = 'N/A';
    let timeFeedback = "Marcaje fuera de rango";

    for (const s of schedules) {
        const checkWindow = (targetTime: string, before: number, after: number, dateRef: string, dayOffset = 0) => {
            if (!targetTime) return false;
            const [h, m] = targetTime.split(':').map(Number);
            const target = new Date(`${dateRef}T${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00-05:00`);
            if (dayOffset) target.setDate(target.getDate() + dayOffset);
            const startLimit = new Date(target.getTime() - (before * 60000));
            const endLimit = new Date(target.getTime() + (after * 60000));
            return now >= startLimit && now <= endLimit;
        };

        const baseDate = s.schedule_date instanceof Date ? s.schedule_date.toISOString().split('T')[0] : s.schedule_date;
        if (checkWindow(s.start_time, s.entry_start_buffer, s.entry_end_buffer, baseDate)) {
            detectedType = 'IN'; timeMatch = true; timeFeedback = "Entrada"; currentShift = s; break;
        }
        const isOutRollover = s.end_time < s.start_time ? 1 : 0;
        if (checkWindow(s.end_time, s.exit_start_buffer, s.exit_end_buffer, baseDate, isOutRollover)) {
            detectedType = 'OUT'; timeMatch = true; timeFeedback = "Salida"; currentShift = s; break;
        }
    }

    if (!currentShift) {
        currentShift = schedules.find((s: any) => (s.schedule_date instanceof Date ? s.schedule_date.toISOString().split('T')[0] : s.schedule_date) === todayStr) || null;
    }

    // --- Lógica Geográfica ---
    let zoneMatch = false;
    if (currentShift && coords && coords.lat && coords.lat !== 0) {
        if (currentShift.marking_zone_id) {
            const [zones]: any = await pool.query('SELECT name, lat, lng, radius, zone_type, bounds FROM marking_zones WHERE id = ?', [currentShift.marking_zone_id]);
            if (zones.length > 0) {
                const zone = zones[0];
                const dist = this.calculateHaversineDistance(coords.lat, coords.lng, Number(zone.lat), Number(zone.lng));
                zoneMatch = dist <= Number(zone.radius);
            }
        } else { zoneMatch = true; }
    }

    const markingResult = await this.attendanceService.registerMarking(
      companyId,
      { 
          identification: collaborator.identification, 
          lat: coords?.lat, 
          lng: coords?.lng, 
          scheduleId: currentShift?.schedule_id || null,
          type: detectedType === 'N/A' ? undefined : detectedType,
          status: 'Unknown',
          markingZoneId: currentShift?.marking_zone_id || null,
          isValidZone: zoneMatch
      }
    );

    await pool.execute(
        'UPDATE attendance_records SET biometric_method = ?, validation_method = ? WHERE id = ?',
        ['FINGER', 'FINGER', markingResult.id]
    );

    return { 
        ...markingResult, 
        collaboratorName: `${collaborator.first_name} ${collaborator.last_name}`, 
        collaboratorInfo: {
            photo: collaborator.photo,
            email: collaborator.email,
            phone: collaborator.phone,
            position: collaborator.position_name
        }, 
        confidence: "1.0000",
        match: true,
        biometricMethod: 'FINGER',
        finger_name: collaborator.finger_name,
        type: detectedType,
        shift: currentShift ? {
            id: currentShift.id,
            name: currentShift.name,
            prefix: currentShift.prefix,
            start_time: currentShift.start_time,
            end_time: currentShift.end_time
        } : null,
        validation: {
            has_schedule: !!currentShift,
            shift_match: timeMatch,
            zone_match: currentShift ? zoneMatch : false
        },
        zone_name: zoneMatch ? (currentShift?.marking_zone_id ? 'Ubicación Válida' : 'Ubicación Libre') : 'Fuera de Cobertura',
        lat: coords?.lat,
        lng: coords?.lng
    };
  }
}
