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
      'DELETE FROM collaborator_biometrics WHERE collaborator_id = ? AND company_id = ?',
      [collaboratorId, companyId]
    );
  }

  // --- HUELLAS DACTILARES ---
  async saveFingerprint(data: { id: string, company_id: string, collaborator_id: string, finger_name: string, template: any, device_info?: any }) {
    await pool.execute(
      `INSERT INTO collaborator_fingerprints (id, company_id, collaborator_id, finger_name, biometric_template, device_info) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE biometric_template = VALUES(biometric_template), device_info = VALUES(device_info)`,
      [data.id, data.company_id, data.collaborator_id, data.finger_name, JSON.stringify(data.template), data.device_info ? JSON.stringify(data.device_info) : null]
    );
  }

  async getFingersByCollaborator(companyId: string, collaboratorId: string) {
    const [rows]: any = await pool.execute(
      'SELECT id, finger_name, createdAt, device_info FROM collaborator_fingerprints WHERE company_id = ? AND collaborator_id = ? ORDER BY createdAt DESC',
      [companyId, collaboratorId]
    );
    return rows;
  }

  async deleteFingerprint(companyId: string, id: string) {
    await pool.execute(
      'DELETE FROM collaborator_fingerprints WHERE id = ? AND company_id = ?',
      [id, companyId]
    );
  }
}
