import { BiometricRepository } from './biometrics.repository';
import { AttendanceService } from '../attendance/attendance.service';
import { generateUUID } from '../../utils/uuid';
import pool from '../../config/database';

export class BiometricService {
  private repository = new BiometricRepository();
  private attendanceService = new AttendanceService();

  // Umbral de similitud (Distancia Euclidiana). Típico 0.6 para face-api.js
  private readonly DEFAULT_THRESHOLD = 0.5;

  async enroll(companyId: string, collaboratorId: string, descriptor: number[]) {
    // Validar que el colaborador pertenece a la empresa y está activo
    const [collab]: any = await pool.execute(
      'SELECT id, is_active FROM collaborators WHERE id = ? AND company_id = ?',
      [collaboratorId, companyId]
    );

    if (!collab.length) throw new Error('Colaborador no encontrado');
    if (!collab[0].is_active) throw new Error('El colaborador no está activo');

    const id = generateUUID();
    await this.repository.saveTemplate({
      id,
      company_id: companyId,
      collaborator_id: collaboratorId,
      template: descriptor,
      provider: 'face-api-js'
    });

    return { success: true, biometric_id: id };
  }

  async verifyAndMark(companyId: string, identification: string, inputDescriptor: number[], coords?: { lat: number, lng: number }) {
    // 1. Buscar colaborador por identificación
    const [collab]: any = await pool.execute(
      'SELECT id, first_name, last_name, is_active FROM collaborators WHERE identification = ? AND company_id = ?',
      [identification, companyId]
    );

    if (!collab.length) throw new Error('Identidad no registrada');
    const target = collab[0];

    if (!target.is_active) throw new Error('Perfil inhabilitado');

    // 2. Obtener plantilla guardada
    const storedBio = await this.repository.getTemplateByCollaborator(companyId, target.id);
    if (!storedBio) throw new Error('No se ha enrolado biometría facial para este usuario');

    // 3. Comparar vectores (Distancia Euclidiana)
    const storedDescriptor = typeof storedBio.biometric_template === 'string' 
      ? JSON.parse(storedBio.biometric_template) 
      : storedBio.biometric_template;

    const distance = this.calculateEuclideanDistance(inputDescriptor, storedDescriptor);
    
    // Obtener threshold configurable de la empresa o usar default
    let threshold = this.DEFAULT_THRESHOLD;
    try {
      const [settings]: any = await pool.execute('SELECT settings FROM companies WHERE id = ?', [companyId]);
      if (settings.length && settings[0].settings) {
        const parsedSettings = typeof settings[0].settings === 'string' ? JSON.parse(settings[0].settings) : settings[0].settings;
        threshold = parsedSettings.faceIdThreshold || this.DEFAULT_THRESHOLD;
      }
    } catch (e) {
      console.warn("No se pudo cargar settings de empresa, usando default threshold");
    }

    if (distance > threshold) {
      throw new Error('Validación fallida: El rostro no coincide con la firma registrada');
    }

    // 4. Proceder al marcaje de asistencia
    const markingResult = await this.attendanceService.registerMarking(
      companyId, 
      identification, 
      coords?.lat, 
      coords?.lng
    );

    // 5. Actualizar registro con metadata biométrica
    await pool.execute(
      'UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ? WHERE id = ?',
      [storedBio.id, distance, markingResult.id]
    );

    return {
      ...markingResult,
      biometric_match: true,
      confidence_score: (1 - distance).toFixed(4)
    };
  }

  private calculateEuclideanDistance(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) throw new Error('Dimensiones de vectores no coinciden');
    return Math.sqrt(
      v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0)
    );
  }
}
