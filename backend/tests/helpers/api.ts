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

export interface ApiErrorBody {
  error: { code: string; message: string; details: Record<string, unknown> };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

/** Reads the `{ data }` envelope from a successful single-resource response. */
export function dataOf<T>(response: { body: unknown }): T {
  return (response.body as { data: T }).data;
}

/** Reads a `{ data, meta }` list envelope unchanged. */
export function listOf<T>(response: { body: unknown }): Paginated<T> {
  return response.body as Paginated<T>;
}

/** Reads the `{ error }` envelope from a failed response. */
export function errorOf(response: { body: unknown }): ApiErrorBody['error'] {
  return (response.body as ApiErrorBody).error;
}
