
import { Request, Response } from 'express';
import { CompanyService } from './companies.service';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
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
