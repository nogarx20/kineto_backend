
import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private repository = new ReportsRepository();

  async getDashboardStats(companyId: string) {
    const compliance = await this.repository.getComplianceStats(companyId);
    const distribution = await this.repository.getAttendanceDistribution(companyId);
    
    const chartData = compliance.map((c: any) => ({
      name: c.name,
      programado: c.programado,
      ejecutado: c.ejecutado,
      puntualidad: c.ejecutado > 0 ? Math.round(100 - ((c.late_count / c.ejecutado) * 100)) : 100
    }));

    const colorMap: any = {
      'OnTime': '#10b981',
      'Late': '#f59e0b',
      'EarlyDeparture': '#f97316',
      'Overtime': '#3b82f6',
      'Unknown': '#94a3b8'
    };

    const pieData = distribution.map((d: any) => ({
      name: d.status,
      value: d.count,
      color: colorMap[d.status] || '#94a3b8'
    }));

    return { chartData, pieData };
  }

  async getAuditLogs(companyId: string) {
    return await this.repository.getAuditLogs(companyId);
  }
}
