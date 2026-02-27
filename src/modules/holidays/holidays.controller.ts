// c:\Users\siste\Videos\Asistenza-Pro\backend\src\modules\holidays\holidays.controller.ts
import { Request, Response } from 'express';
import { HolidaysService } from './holidays.service';

const service = new HolidaysService();

export class HolidaysController {
  async list(req: Request, res: Response) {
    try {
      const data = await service.getHolidays();
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
