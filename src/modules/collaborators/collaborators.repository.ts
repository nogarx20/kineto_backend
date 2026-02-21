import pool from '../../config/database';

export class CollaboratorRepository {
  
  // --- Collaborators ---
  async findAll(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT 
        c.*, 
        c.status as collab_status_id,
        con.id as contract_id,
        con.position_name,
        con.cost_center_id,
        cc.code as cost_center_code,
        con.contract_code,
        con.start_date as contract_start,
        con.end_date as contract_end,
        con.rest_days,
        con.working_days,
        con.discount_lunch,
        con.weekly_hours,
        con.status as contract_status,
        EXISTS(SELECT 1 FROM collaborator_biometrics cb WHERE cb.collaborator_id = c.id) as has_faceid,
        (SELECT COUNT(*) FROM collaborator_fingerprints cf WHERE cf.collaborator_id = c.id) as finger_count
      FROM collaborators c
      LEFT JOIN contracts con ON con.collaborator_id = c.id AND con.onDelete = 0
      LEFT JOIN cost_centers cc ON con.cost_center_id = cc.id AND cc.onDelete = 0
      WHERE c.company_id = ? AND c.onDelete = 0
      ORDER BY c.first_name, c.last_name
    `, [companyId]);

    const collaboratorsMap = new Map();

    const statusMap = ['Active', 'Inactive', 'Pending', 'Rejected'];

    rows.forEach((row: any) => {
        if (!collaboratorsMap.has(row.id)) {
            collaboratorsMap.set(row.id, {
                ...row,
                status: statusMap[row.collab_status_id] || 'Pending',
                contracts: [],
                // Mantener compatibilidad con campos planos (usando el activo o el último encontrado)
                last_contract_code: null,
                position_name: null,
                cost_center_code: null
            });
        }

        const collab = collaboratorsMap.get(row.id);

        if (row.contract_id) {
            const contract = {
                id: row.contract_id,
                contract_code: row.contract_code,
                position_name: row.position_name,
                cost_center_id: row.cost_center_id,
                cost_center_code: row.cost_center_code,
                start_date: row.contract_start,
                end_date: row.contract_end,
                status: row.contract_status,
                weekly_hours: row.weekly_hours
            };
            collab.contracts.push(contract);

            // Priorizar contrato activo para la vista principal
            if (row.contract_status === 'Activo') {
                collab.last_contract_code = row.contract_code;
                collab.position_name = row.position_name;
                collab.cost_center_code = row.cost_center_code;
                // Se pueden mapear otros campos si es necesario
            }
        }
    });

    return Array.from(collaboratorsMap.values());
  }

  async findById(companyId: string, id: string) {
    const [rows]: any = await pool.execute(
      'SELECT * FROM collaborators WHERE company_id = ? AND id = ? AND onDelete = 0',
      [companyId, id]
    );
    return rows[0];
  }

  async create(data: any) {
    const { 
      id, company_id, identification, first_name, last_name, 
      email, phone, address, gender, birth_date, username, password, photo, pin, status
    } = data;
    
    // Mapeo Frontend -> DB: Active(0), Inactive(1), Pending(2), Rejected(3)
    const statusMap: any = { 'Active': 0, 'Inactive': 1, 'Pending': 2, 'Rejected': 3 };
    const dbStatus = statusMap[status] ?? 2;

    await pool.execute(`
      INSERT INTO collaborators 
      (id, company_id, identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, photo, pin, status, is_active, onDelete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, company_id, identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, photo || null, pin || null, dbStatus, dbStatus === 0 ? 1 : 0]);
    
    return id;
  }

  async update(id: string, companyId: string, data: any) {
    const { identification, first_name, last_name, email, phone, address, gender, birth_date, username, password, photo, pin, status } = data;
    
    const statusMap: any = { 'Active': 0, 'Inactive': 1, 'Pending': 2, 'Rejected': 3 };
    const dbStatus = statusMap[status] ?? 2;
    
    const updates = [
        'identification = ?', 'first_name = ?', 'last_name = ?', 'email = ?', 
        'phone = ?', 'address = ?', 'gender = ?', 'birth_date = ?', 
        'username = ?', 'is_active = ?', 'photo = ?', 'pin = ?', 'status = ?'
    ];
    const params: any[] = [
        identification, first_name, last_name, email, phone, 
        address, gender, birth_date, username, dbStatus === 0 ? 1 : 0, photo || null, pin || null, dbStatus
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
    await pool.execute('UPDATE collaborators SET onDelete = 1 WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Contracts ---
  async listContracts(companyId: string) {
    const [rows]: any = await pool.execute(`
      SELECT con.*, col.first_name, col.last_name, col.photo, cc.name as cost_center_name, cc.code as cost_center_code
      FROM contracts con
      JOIN collaborators col ON con.collaborator_id = col.id
      JOIN cost_centers cc ON con.cost_center_id = cc.id
      WHERE con.company_id = ? AND con.onDelete = 0
    `, [companyId]);
    return rows;
  }

  async createContract(data: any) {
    const { 
      id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date, 
      position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime, discount_lunch, status 
    } = data;
    
    await pool.execute(`
      INSERT INTO contracts 
      (id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime, discount_lunch, status, onDelete)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [id, company_id, collaborator_id, cost_center_id, contract_code, start_date, end_date || null, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime ? 1 : 0, discount_lunch ? 1 : 0, status || 'Activo']);
    
    return id;
  }

  async updateContract(id: string, companyId: string, data: any) {
    const { 
      cost_center_id, start_date, end_date, position_name, contract_type, 
      weekly_hours, working_days, rest_days, generates_overtime, discount_lunch, status 
    } = data;

    await pool.execute(`
      UPDATE contracts 
      SET cost_center_id = ?, start_date = ?, end_date = ?, position_name = ?, 
          contract_type = ?, weekly_hours = ?, working_days = ?, rest_days = ?, generates_overtime = ?, discount_lunch = ?, status = ?
      WHERE id = ? AND company_id = ?
    `, [cost_center_id, start_date, end_date || null, position_name, contract_type, weekly_hours, working_days, rest_days, generates_overtime ? 1 : 0, discount_lunch ? 1 : 0, status, id, companyId]);
  }

  async deleteContract(id: string, companyId: string) {
    await pool.execute('UPDATE contracts SET onDelete = 1 WHERE id = ? AND company_id = ?', [id, companyId]);
  }

  // --- Auxiliaries ---
  async createPosition(data: any) {
    await pool.execute(
      'INSERT INTO positions (id, company_id, name, onDelete) VALUES (?, ?, ?, 0)',
      [data.id, data.company_id, data.name]
    );
  }

  async listPositions(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM positions WHERE company_id = ? AND onDelete = 0', [companyId]);
    return rows;
  }

  async createCostCenter(data: any) {
    await pool.execute(
      'INSERT INTO cost_centers (id, company_id, code, name, onDelete) VALUES (?, ?, ?, ?, 0)',
      [data.id, data.company_id, data.code, data.name]
    );
  }

  async listCostCenters(companyId: string) {
    const [rows]: any = await pool.execute('SELECT * FROM cost_centers WHERE company_id = ? AND onDelete = 0', [companyId]);
    return rows;
  }
}
