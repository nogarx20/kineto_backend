
import pool from '../../config/database';

export class CollaboratorRepository {
  
  // --- Collaborators ---
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        c.*, 
        con.position_name,
        con.cost_center_id,
        cc.code as cost_center_code,
        con.contract_code as last_contract_code,
        con.start_date as contract_start,
        con.end_date as contract_end,
        con.rest_days,
        con.working_days
      FROM collaborators c
      LEFT JOIN contracts con ON con.collaborator_id = c.id AND con.status = 'Activo'
      LEFT JOIN cost_centers cc ON con.cost_center_id = cc.id
      WHERE c.company_id = ?
    `, [companyId]);
    return rows;
  }

  async findById(companyId: string, id: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM collaborators WHERE company_id = ? AND id = ?',
      [companyId, id]
    );
    return rows[0];
  }

  async create(data: any) {
    const { 
      id, company_id, identification, first_name, last_name, 
      email, phone, address, gender, birth_date, username, password, photo 
    } = data;
    
    await pool.execute(`
      INSERT INTO collaborators 
      (id, company_id, identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, photo || null]);
    
    return id;
  }

  async update(id: string, companyId: string, data: any) {
    const { identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, is_active, photo } = data;
    
    const updates = [
        'identification = ?', 'first_name = ?', 'last_name = ?', 'email = ?', 
        'phone = ?', 'address = ?', 'gender = ?', 'birth_date = ?', 
        'username = ?', 'is_active = ?', 'photo = ?'
    ];
    const params: any[] = [
        identification, first_name, last_name, email, phone, 
        address, gender, birth_date, username, is_active ? 1 : 0, photo || null
    ];

    if (password !== undefined && password !== null && password !== '') {
        updates.push('password = ?');
        params.push(password);
    }

    params.push(id, companyId);
    
    await pool.execute(`
      UPDATE collaborators 
      SET ${updates.join(', ')}
      WHERE id = ? AND company_id = ?
    `, params);
  }

  async delete(id: string, companyId: string) {
    await pool.execute('DELETE FROM collaborators WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Contracts ---
  async listContracts(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT con.*, col.first_name, col.last_name, cc.name as cost_center_name, cc.code as cost_center_code
      FROM contracts con
      JOIN collaborators col ON con.collaborator_id = col.id
      JOIN cost_centers cc ON con.cost_center_id = cc.id
      WHERE con.company_id = ?
    `, [companyId]);
    return rows;
  }

  async createContract(data: any) {
    const { 
      id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date, 
      position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime, status 
    } = data;
    
    await pool.execute(`
      INSERT INTO contracts 
      (id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date || null, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime ? 1 : 0, status || 'Activo']);
    
    return id;
  }

  async updateContract(id: string, companyId: string, data: any) {
    const { 
      cost_center_id, start_date, end_date, position_name, contract_type, 
      weekly_hours, working_days, rest_days, generates_overtime, status 
    } = data;

    await pool.execute(`
      UPDATE contracts 
      SET cost_center_id = ?, start_date = ?, end_date = ?, position_name = ?, 
          contract_type = ?, weekly_hours = ?, working_days = ?, rest_days = ?, generates_overtime = ?, status = ?
      WHERE id = ? AND company_id = ?
    `, [cost_center_id, start_date, end_date || null, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime ? 1 : 0, status, id, companyId]);
  }

  async deleteContract(id: string, companyId: string) {
    await pool.execute('DELETE FROM contracts WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Auxiliaries ---
  async createPosition(data: any) {
    await pool.execute(
      'INSERT INTO positions (id, company_id, name) VALUES (?, ?, ?)',
      [data.id, data.company_id, data.name]
    );
  }

  async listPositions(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM positions WHERE company_id = ?', [companyId]);
    return rows;
  }

  async createCostCenter(data: any) {
    await pool.execute(
      'INSERT INTO cost_centers (id, company_id, code, name) VALUES (?, ?, ?, ?)',
      [data.id, data.company_id, data.code, data.name]
    );
  }

  async listCostCenters(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM cost_centers WHERE company_id = ?', [companyId]);
    return rows;
  }
}
