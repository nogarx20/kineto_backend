
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
    const inputDescriptor = this.normalizeDescriptor(inputRawDescriptor);
    
    // 1. Obtener todas las plantillas de la empresa
    const [templates]: any = await pool.execute(
      'SELECT b.*, c.identification FROM collaborator_biometrics b JOIN collaborators c ON b.collaborator_id = c.id WHERE b.company_id = ? AND c.is_active = 1',
      [companyId]
    );

    if (!templates.length) throw new Error('No hay firmas faciales registradas en la empresa.');

    // 2. Buscar coincidencia
    let bestMatch: any = null;
    let minDistance = Infinity;

    for (const t of templates) {
      const storedDescriptor = typeof t.biometric_template === 'string' 
        ? JSON.parse(t.biometric_template) 
        : t.biometric_template;
      
      const distance = this.calculateEuclideanDistance(inputDescriptor, storedDescriptor);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = t;
      }
    }

    // 3. Validar contra umbral
    let threshold = this.DEFAULT_THRESHOLD;
    const [settings]: any = await pool.execute('SELECT settings FROM companies WHERE id = ?', [companyId]);
    if (settings.length && settings[0].settings) {
        const parsed = typeof settings[0].settings === 'string' ? JSON.parse(settings[0].settings) : settings[0].settings;
        threshold = parsed.faceIdThreshold || this.DEFAULT_THRESHOLD;
    }

    if (!bestMatch || minDistance > threshold) {
      throw new Error('Identidad no reconocida. Intente de nuevo.');
    }

    // 4. Proceder con el marcaje usando el ID encontrado
    const markingResult = await this.attendanceService.registerMarking(companyId, bestMatch.identification, coords?.lat, coords?.lng);
    
    // Actualizar metadata
    await pool.execute(
      'UPDATE attendance_records SET biometric_validation_id = ?, biometric_score = ? WHERE id = ?',
      [bestMatch.id, minDistance, markingResult.id]
    );

    return {
      ...markingResult,
      confidence: (1 - minDistance).toFixed(4),
      match: true
    };
  }

  async verifyAndMark(companyId: string, identification: string, inputRawDescriptor: number[], coords?: { lat: number, lng: number }) {
    const inputDescriptor = this.normalizeDescriptor(inputRawDescriptor);
    const [collab]: any = await pool.execute(
      'SELECT id, is_active FROM collaborators WHERE identification = ? AND company_id = ?',
      [identification, companyId]
    );
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
}
