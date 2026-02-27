// c:\Users\siste\Videos\Asistenza-Pro\backend\src\modules\holidays\holidays.routes.ts
import { Router } from 'express';
import { HolidaysController } from './holidays.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();
const controller = new HolidaysController();

router.use(authMiddleware);

router.get('/', controller.list);

export default router;
