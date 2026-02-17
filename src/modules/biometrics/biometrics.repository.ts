
import pool from '../../config/database';

export class BiometricRepository {
  async saveTemplate(data: { id: string, company_id: string, collaborator_id: string, template: number[], provider: string }) {
    await pool.execute(
      `INSERT INTO collaborator_biometrics (id, company_id, collaborator_id, biometric_template, provider) 
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE biometric_template = VALUES(biometric_template), provider = VALUES(provider)`,
      [data.id, data.company_id, data.collaborator_id, JSON.stringify(data.template), data.provider]
    );
  }

  async getTemplateByCollaborator(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM collaborator_biometrics WHERE company_id = ? AND collaborator_id = ?',
      [companyId, collaboratorId]
    );
    return rows[0];
  }

  async deleteTemplate(companyId: string, collaboratorId: string) {
    await pool.execute(
      'DELETE FROM collaborator_biometrics WHERE company_id = ? AND collaborator_id = ?',
      [companyId, collaboratorId]
    );
  }

  // --- Fingerprints ---
  async saveFingerprint(data: { id: string, company_id: string, collaborator_id: string, finger_index: number, finger_name: string, template: string, device_id: string }) {
    await pool.execute(
      `INSERT INTO collaborator_fingerprints (id, company_id, collaborator_id, finger_index, finger_name, biometric_template, device_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE biometric_template = VALUES(biometric_template), finger_name = VALUES(finger_name), device_id = VALUES(device_id)`,
      [data.id, data.company_id, data.collaborator_id, data.finger_index, data.finger_name, data.template, data.device_id]
    );
  }

  async getFingersByCollaborator(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(
      'SELECT id, collaborator_id, finger_index, finger_name, device_id, createdAt FROM collaborator_fingerprints WHERE company_id = ? AND collaborator_id = ? ORDER BY finger_index',
      [companyId, collaboratorId]
    );
    return rows;
  }

  async deleteFingerprint(companyId: string, collaboratorId: string, fingerIndex: number) {
    await pool.execute(
      'DELETE FROM collaborator_fingerprints WHERE company_id = ? AND collaborator_id = ? AND finger_index = ?',
      [companyId, collaboratorId, fingerIndex]
    );
  }
}
