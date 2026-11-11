import { Router } from 'express';
import { adjustmentRouter } from './adjustment.routes.js';
import { alertRouter } from './alert.routes.js';
import { auditLogRouter } from './audit-log.routes.js';
import { authRouter } from './auth.routes.js';
import { batchRouter } from './batch.routes.js';
import { categoryRouter } from './category.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { healthRouter } from './health.routes.js';
import { medicineRouter } from './medicine.routes.js';
import { purchaseRouter } from './purchase.routes.js';
import { reportRouter } from './report.routes.js';
import { returnRouter } from './return.routes.js';
import { saleRouter } from './sale.routes.js';
import { settingRouter } from './setting.routes.js';
import { stockMovementRouter } from './stock-movement.routes.js';
import { supplierRouter } from './supplier.routes.js';
import { usersRouter } from './users.routes.js';

/** Everything under `/api/v1`. Routers are added here as phases land. */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/suppliers', supplierRouter);
apiRouter.use('/medicines', medicineRouter);
apiRouter.use('/purchases', purchaseRouter);
apiRouter.use('/sales', saleRouter);
apiRouter.use('/returns', returnRouter);
apiRouter.use('/adjustments', adjustmentRouter);
apiRouter.use('/batches', batchRouter);
apiRouter.use('/stock-movements', stockMovementRouter);
apiRouter.use('/alerts', alertRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/reports', reportRouter);
apiRouter.use('/audit-logs', auditLogRouter);
apiRouter.use('/settings', settingRouter);
