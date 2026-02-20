import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private repository = new ReportsRepository();

  async getDashboardStats(companyId: string) {
    const [
      compliance, 
      distribution, 
      todayMarkings, 
      failed24h, 
      recentLogs
    ] = await Promise.all([
      this.repository.getComplianceStats(companyId),
      this.repository.getAttendanceDistribution(companyId),
      this.repository.getTodayMarkingsCount(companyId),
      this.repository.getFailedEvents24hCount(companyId),
      this.repository.getRecentAttendanceLogs(companyId, 5)
    ]);
    
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

    const recentActivity = recentLogs.map((l: any) => {
      const details = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
      return {
        id: l.id,
        name: details?.identification || 'Usuario',
        time: new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: details?.result?.type || 'IN',
        valid: l.action === 'MARK_ATTENDANCE'
      };
    });

    return { 
      chartData, 
      pieData, 
      todayMarkings, 
      failedAccess24h: failed24h,
      recentActivity 
    };
  }

  async getAuditLogs(companyId: string) {
    return await this.repository.getAuditLogs(companyId);
  }
}
