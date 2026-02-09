"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const reports_repository_1 = require("./reports.repository");
class ReportsService {
    constructor() {
        this.repository = new reports_repository_1.ReportsRepository();
    }
    async getDashboardStats(companyId) {
        const compliance = await this.repository.getComplianceStats(companyId);
        const distribution = await this.repository.getAttendanceDistribution(companyId);
        // Transform data for UI
        const chartData = compliance.map((c) => ({
            name: c.name,
            programado: c.programado,
            ejecutado: c.ejecutado, // Asumiendo que 2 marcajes (Entrada/Salida) = 1 turno completo aproximadamente para simplificar visualización
            puntualidad: c.ejecutado > 0 ? Math.round(100 - ((c.late_count / c.ejecutado) * 100)) : 100
        }));
        // Mapeo de colores para la gráfica de pastel
        const colorMap = {
            'OnTime': '#10b981', // green
            'Late': '#f59e0b', // amber
            'EarlyDeparture': '#f97316', // orange
            'Overtime': '#3b82f6', // blue
            'Unknown': '#94a3b8' // slate
        };
        const pieData = distribution.map((d) => ({
            name: d.status,
            value: d.count,
            color: colorMap[d.status] || '#94a3b8'
        }));
        return { chartData, pieData };
    }
}
exports.ReportsService = ReportsService;
