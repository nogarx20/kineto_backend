import { Request, Response } from 'express';
import { CompanyService } from './companies.service';
import { logAudit } from '../../middlewares/audit.middleware';

const companyService = new CompanyService();

export class CompanyController {
  async create(req: Request, res: Response) {
    try {
      const body = (req as any).body;
      const company = await companyService.createCompany(body);
      
      if ((req as any).user) {
        await logAudit(req, 'CREATE', 'companies', company.id, { name: company.name });
      }

      (res as any).status(201).json(company);
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async update(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      const body = (req as any).body;
      await (companyService as any).repository.update(id, body);
      
      await logAudit(req, 'UPDATE', 'companies', id, body);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const { id } = (req as any).params;
      
      // Validar si es la empresa actual del usuario para evitar auto-eliminación accidental
      const user = (req as any).user;
      if (user.company_id === id) {
        throw new Error('No es posible eliminar la organización a la que pertenece actualmente.');
      }

      await (companyService as any).repository.delete(id);
      await logAudit(req, 'DELETE', 'companies', id);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }

  async list(req: Request, res: Response) {
    try {
      const companies = await companyService.listCompanies();
      (res as any).json(companies);
    } catch (err: any) {
      (res as any).status(500).json({ error: err.message });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const company = await companyService.getCompany(user!.company_id);
      (res as any).json(company);
    } catch (err: any) {
      (res as any).status(404).json({ error: err.message });
    }
  }

  async updateSettings(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const settings = (req as any).body;
      await companyService.updateSettings(user!.company_id, settings);
      
      await logAudit(req, 'UPDATE_SETTINGS', 'companies', user!.company_id, settings);
      (res as any).json({ success: true });
    } catch (err: any) {
      (res as any).status(400).json({ error: err.message });
    }
  }
}