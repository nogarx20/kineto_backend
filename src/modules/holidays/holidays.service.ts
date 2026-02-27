// c:\Users\siste\Videos\Asistenza-Pro\backend\src\modules\holidays\holidays.service.ts
import { HolidaysRepository } from './holidays.repository';

export class HolidaysService {
  private repository = new HolidaysRepository();

  async getHolidays() {
    return await this.repository.findAll();
  }
}
