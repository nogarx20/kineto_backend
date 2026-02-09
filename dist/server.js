"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const PORT = process.env.PORT || 3000;
const startServer = async () => {
    try {
        // Test database connection
        const connection = await database_1.default.getConnection();
        console.log('✅ Base de Datos Conectada Correctamente');
        connection.release();
        app_1.default.listen(PORT, () => {
            console.log(`🚀 Servidor Asistenza Pro ejecutándose en http://localhost:${PORT}`);
        });
    }
    catch (err) {
        console.error('❌ Error al iniciar el servidor:', err);
        // Fix: Cast process to any to call exit as the property is reported as missing on the Process type
        process.exit(1);
    }
};
startServer();
