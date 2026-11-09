import request from 'supertest';
import { app } from '../../src/app.js';

/** Supertest client bound to the real Express app (no port is opened). */
export const api = () => request(app);

export const DEMO_PASSWORD = 'Demo@1234';

export const SEEDED_USERS = {
  admin: 'admin@pharmacy.test',
  pharmacist: 'pharmacist@pharmacy.test',
  inventory: 'inventory@pharmacy.test',
} as const;

/** Logs in a seeded user and returns the Bearer token. */
export async function loginAs(email: string): Promise<string> {
  const response = await api().post('/api/v1/auth/login').send({ email, password: DEMO_PASSWORD });

  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return (response.body as { data: { token: string } }).data.token;
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
}
