import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { batchRouter } from './batch.routes.js';
import { categoryRouter } from './category.routes.js';
import { healthRouter } from './health.routes.js';
import { medicineRouter } from './medicine.routes.js';
import { purchaseRouter } from './purchase.routes.js';
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
apiRouter.use('/batches', batchRouter);
apiRouter.use('/stock-movements', stockMovementRouter);
