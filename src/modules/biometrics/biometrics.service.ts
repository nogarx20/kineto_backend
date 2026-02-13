import { BiometricRepository } from './biometrics.repository';
import { AttendanceService } from '../attendance/attendance.service';
import pool from '../../config/database';
import { generateUUID } from '../../utils/uuid';

export class BiometricService {
  private repository = new BiometricRepository();
  private attendanceService = new AttendanceService();

  private readonly DESCRIPTOR_LENGTH = 128;
  private readonly DEFAULT_THRESHOLD = 0.55; // Un poco más estricto que 0.6 para producción

  /**
   * Valida la estructura y normaliza el descriptor para asegurar longitud unitaria
   */
  private normalizeDescriptor(descriptor: number[]): number[] {
    if (!Array.isArray(descriptor) || descriptor.length !== this.DESCRIPTOR_LENGTH) {
      throw new Error(`Estructura biométrica inválida: se esperan ${this.DESCRIPTOR_LENGTH} dimensiones.`);
    }
    if (descriptor.some(v => typeof v !== 'number' || isNaN(v))) {
      throw new Error('El descriptor contiene valores no numéricos o inválidos.');
    }
    
    // Cálculo de magnitud para Normalización L2
    const magnitude = Math.sqrt(descriptor.reduce((sum, v) => sum + v * v, 0));
    
    if (magnitude === 0) {
      throw new Error('Calidad biométrica insuficiente: El sensor no capturó información válida.');
    }

    // Normalizar el vector para que su magnitud sea exactamente 1.0
    // Esto resuelve el error de "el vector no está normalizado" y mejora la precisión de la comparación
    return descriptor.map(v => v / magnitude);
  }

  async enroll(companyId: string, collaboratorId: string, rawDescriptor: number[]) {
    const descriptor = this.normalizeDescriptor(rawDescriptor);

    // Verificar existencia del colaborador
    const [collab]: any = await pool.execute(
      'SELECT id, is_active FROM collaborators WHERE id = ? AND company_id = ?',
      [collaboratorId, companyId]
    );

    if (!collab.length) throw new Error('Colaborador no encontrado en esta empresa.');
    if (!collab[0].is_active) throw new Error('No se puede enrolar a un colaborador inactivo.');

    const id = generateUUID();
    await this.repository.saveTemplate({
      id,
      company_id: companyId,
      collaborator_id: collaboratorId,
      template: descriptor,
      provider: 'face-api-js-v1'
    });

    return { success: true, message: 'Firma facial registrada correctamente.' };
  }

  // Fix: Add delete method to remove facial templates
  async delete(companyId: string, collaboratorId: string) {
    await this.repository.deleteTemplate(companyId, collaboratorId);
    return { success: true, message: 'Firma facial eliminada correctamente.' };
  }

  async verifyAndMark(companyId: string, identification: string, inputRawDescriptor: number[], coords?: { lat: number, lng: number }) {
    const inputDescriptor = this.normalizeDescriptor(inputRawDescriptor);

    // 1. Buscar colaborador
    const [collab]: any = await pool.execute(
      'SELECT id, first_name, last_name, is_active FROM collaborators WHERE identification = ? AND company_id = ?',
      [identification, companyId]
    );

    if (!collab.length) throw new Error('Identidad no reconocida.');
    const target = collab[0];
    if (!target.is_active) throw new Error('Acceso denegado: Usuario inactivo.');

    // 2. Obtener plantilla guardada
    const storedBio = await this.repository.getTemplateByCollaborator(companyId, target.id);
    if (!storedBio) throw new Error('No se ha registrado una firma facial para este usuario. Contacte a RRHH.');

    // 3. Cálculo de Distancia Euclidiana
    const storedDescriptor = typeof storedBio.biometric_template === 'string' 
      ? JSON.parse(storedBio.biometric_template) 
      : storedBio.biometric_template;

    const distance = this.calculateEuclideanDistance(inputDescriptor, storedDescriptor);
    
    // 4. Obtener umbral configurable
    let threshold = this.DEFAULT_THRESHOLD;
    try {
      const [settings]: any = await pool.execute('SELECT settings FROM companies WHERE id = ?', [companyId]);
      if (settings.length && settings[0].settings) {
        const parsed = typeof settings[0].settings === 'string' ? JSON.parse(settings[0].settings) : settings[0].settings;
        threshold = parsed.faceIdThreshold || this.DEFAULT_THRESHOLD;
      }
    } catch (e) { /* fallback a default */ }

    // Validación final
    if (distance > threshold) {
      // Log específico para auditoría de seguridad
      throw new Error('Validación Biométrica Fallida: El rostro no coincide con el registro.');
    }

    // 5. Registrar asistencia vinculada
    const markingResult = await this.attendanceService.registerMarking(companyId, identification, coords?.lat, coords?.lng);

    // Actualizar metadata del registro de asistencia con el score biométrico
    await pool.execute(
      'UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ? WHERE id = ?',
      [storedBio.id, distance, markingResult.id]
    );

    return {
      ...markingResult,
      confidence: (1 - distance).toFixed(4),
      match: true
    };
  }

  private calculateEuclideanDistance(v1: number[], v2: number[]): number {
    return Math.sqrt(v1.reduce((sum, val, i) => sum + Math.pow(val - v2[i], 2), 0));
  }
}
