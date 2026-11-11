import { Router } from 'express';
import { z } from 'zod';
import { authenticate, currentAuth, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { getSettings, updateSettings } from '../services/setting-service.js';
import { moneyInput } from './validation-schemas.js';

const updateSettingsBody = z
  .object({
    defaultTaxRate: moneyInput
      .refine((value) => Number(value) <= 100, 'Tax rate must be between 0 and 100')
      .optional(),
    nearExpiryDays: z.coerce.number().int().min(1).max(3650).optional(),
  })
  .refine((data) => data.defaultTaxRate !== undefined || data.nearExpiryDays !== undefined, {
    message: 'Provide at least one setting',
  });

type UpdateSettingsBody = z.infer<typeof updateSettingsBody>;

export const settingRouter = Router();

settingRouter.use(authenticate, requireRole('ADMIN'));

/** GET /api/v1/settings — ADMIN only. */
settingRouter.get('/', async (_req, res) => {
  const settings = await getSettings();
  res.json({ data: settings });
});

/** PUT /api/v1/settings — ADMIN only; each changed key is audited. */
settingRouter.put('/', validateBody(updateSettingsBody), async (req, res) => {
  const { userId } = currentAuth(req);
  const updated = await updateSettings(req.body as UpdateSettingsBody, userId);
  res.json({ data: updated });
});
