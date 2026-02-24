import { ReportsRepository } from './reports.repository';

export class ReportsService {
  private repository = new ReportsRepository();

  async getDashboardStats(companyId: string, userId: string, range: string = '7d') {
    // Obtener fecha actual en zona horaria regional (Colombia)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    
    // Calcular rango de fechas para la gráfica
    const startDate = new Date();
    if (range === '15d') startDate.setDate(startDate.getDate() - 15);
    else if (range === '30d') startDate.setDate(startDate.getDate() - 30);
    else startDate.setDate(startDate.getDate() - 7); // Default 7d
    const startDateStr = startDate.toISOString().split('T')[0];

    const [
      totalWorkforce,
      schedulesToday,
      markingsToday,
      trendData,
      recentActivityRaw,
      securityLogsRaw,
      distribution
    ] = await Promise.all([
      this.repository.getTotalActiveWorkforce(companyId),
      this.repository.getSchedulesForDate(companyId, today),
      this.repository.getMarkingsForDate(companyId, today),
      this.repository.getTrendData(companyId, startDateStr, today),
      this.repository.getEnrichedRecentActivity(companyId, 20), // Traemos más para filtrar en front si es necesario
      this.repository.getUserSecurityLogs(companyId, userId, 20),
      this.repository.getAttendanceDistribution(companyId)
    ]);

    // 1. Cálculo de Tasa de Cumplimiento
    let compliantShifts = 0;
    let totalScheduled = schedulesToday.length;
    
    // Agrupar marcajes por colaborador
    const markingsByCollab: Record<string, number> = {};
    let zoneAlertsCount = 0;
    let validMarkingsCount = 0;

    markingsToday.forEach((m: any) => {
      markingsByCollab[m.collaborator_id] = (markingsByCollab[m.collaborator_id] || 0) + 1;
      
      // Verificar alertas: Problema con zona (0) O problema con turno (null)
      if (m.is_valid_zone === 1 && m.schedule_id) {
        validMarkingsCount++;
      } else {
        zoneAlertsCount++;
      }
    });

    schedulesToday.forEach((s: any) => {
      const marks = markingsByCollab[s.collaborator_id] || 0;
      if (s.shift_type === 'Descanso') {
        // Si es descanso, cumple si tiene 0 marcajes (o simplemente no cuenta para la tasa de "asistencia")
        // Para este KPI, asumiremos que "Cumplimiento" se refiere a turnos laborales asistidos.
        // Si es descanso, lo excluimos del total programado para no afectar la tasa de asistencia.
        totalScheduled--; 
      } else if (s.shift_type === 'Partido') {
        if (marks >= 4) compliantShifts++;
      } else {
        // Simple
        if (marks >= 2) compliantShifts++;
      }
    });

    const complianceRate = totalScheduled > 0 ? Math.round((compliantShifts / totalScheduled) * 100) : 100;

    // 2. Formatear Datos de Gráfica
    // Rellenar días faltantes con 0
    const chartDataMap = new Map(trendData.map((d: any) => [d.date.toISOString().split('T')[0], d.ejecutado]));
    const chartData = [];
    const currentDate = new Date(startDate);
    const end = new Date();
    
    while (currentDate <= end) {
      const dStr = currentDate.toISOString().split('T')[0];
      // Nombre del día (Lun, Mar...)
      const dayName = currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
      chartData.push({
        name: dayName,
        date: dStr,
        ejecutado: chartDataMap.get(dStr) || 0,
        programado: 0, // TODO: Calcular programado histórico si es necesario, por ahora 0 o estimado
        puntualidad: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 3. Formatear Actividad Reciente
    const recentActivity = recentActivityRaw.map((l: any) => {
      return {
        id: l.id,
        name: `${l.first_name} ${l.last_name}`,
        identification: l.identification,
        photo: l.photo,
        costCenter: l.cost_center || 'N/A',
        time: new Date(l.timestamp).toLocaleString('es-CO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        type: l.type,
        valid: l.is_valid_zone === 1,
        zoneName: l.zone_name || 'Ubicación Desconocida',
        shiftName: l.shift_name
      };
    });

    // 4. Formatear Logs de Seguridad
    const securityLogs = securityLogsRaw.map((l: any) => ({
      id: l.id,
      action: l.action,
      entity: l.entity,
      details: typeof l.details === 'string' ? JSON.parse(l.details) : l.details,
      time: new Date(l.createdAt).toLocaleString('es-CO')
    }));

    // 5. Pie Data (Distribución)
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

    return { 
      totalWorkforce,
      complianceRate,
      todayMarkings: validMarkingsCount,
      zoneAlerts: zoneAlertsCount,
      chartData, 
      pieData, 
      recentActivity,
      securityLogs
    };
  }

  async getAuditLogs(companyId: string) {
    return await this.repository.getAuditLogs(companyId);
  }
}
