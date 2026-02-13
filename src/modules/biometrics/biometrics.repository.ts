
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
}
