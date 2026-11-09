import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, closeDatabase, DEMO_PASSWORD, loginAs, resetDatabase, SEEDED_USERS } from '../helpers/index.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Auth + RBAC suite (B3).
 *
 * Covers the positive path, credential failures (including the
 * no-user-enumeration guarantee), token failures, 403 on a role-protected
 * route, and immediate effect of deactivation on both login and live tokens.
 */
describe('auth', () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('logs a seeded admin in and the token works on GET /auth/me', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email: SEEDED_USERS.admin, password: DEMO_PASSWORD });

    expect(response.status).toBe(200);

    const { token, user } = (response.body as { data: { token: string; user: { email: string; role: string } } }).data;
    expect(token).toEqual(expect.any(String));
    expect(user).toMatchObject({ email: SEEDED_USERS.admin, role: 'ADMIN' });
    expect(user).not.toHaveProperty('passwordHash');

    const me = await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect((me.body as { data: { email: string } }).data.email).toBe(SEEDED_USERS.admin);
  });

  // 1. wrong password          -> 401, error.code = 'UNAUTHENTICATED', message
  //                               must NOT reveal whether the email exists
  it('rejects a wrong password without revealing the account', async () => {
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email: SEEDED_USERS.admin, password: "wrong-password" });
    
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
    });
  });
  // 2. unknown email           -> 401, same code AND same message as case 1
  it('rejects an unknown email with the same body as a wrong password', async () => {
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@pharmacy.test', password: DEMO_PASSWORD });

    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: SEEDED_USERS.admin, password: 'wrong-password' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  })
  // 3. no Authorization header -> 401 on GET /api/v1/auth/me
  it('rejects a request with no Authorization header', async () => {
    const response = await api()
      .get('/api/v1/auth/me')
    
    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: 'Authentication required' }
    });
  })
  // 4. garbage token           -> 401 (e.g. 'Bearer not-a-real-token')
  it('rejects an invalid token', async () => {
    const response = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer this-is-a-fake-and-invalid-token')

    expect(response.status).toBe(401)
    expect(response.body).toMatchObject({
      error: { code: 'UNAUTHENTICATED', message: 'Invalid or expired token' }
    });
  })
  // 5. pharmacist token        -> GET /api/v1/users returns 403 'FORBIDDEN'
  it('forbids a pharmacist from listing users', async () => {
    const token = await loginAs(SEEDED_USERS.pharmacist);

    const response = await api()
      .get('/api/v1/users')
      .set('Authorization', bearer(token));
    
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action', details: {} },
    });
  })
  // 6. admin token             -> GET /api/v1/users returns 200 with 3 seeded
  //                               users and no passwordHash anywhere
  it('lets an admin list users without exposing password hashes', async () => {
    const token = await loginAs(SEEDED_USERS.admin);

    const response = await api()
      .get('/api/v1/users')
      .set('Authorization', bearer(token));
    
    expect(response.status).toBe(200);

    const { data } = response.body as {
      data: Array<{ id: number; name: string; email: string; role: string; isActive: boolean; createdAt: string }>;
    };

    expect(data).toHaveLength(3)
    expect(data.map((user) => user.email)).toEqual([
      SEEDED_USERS.admin,
      SEEDED_USERS.pharmacist,
      SEEDED_USERS.inventory
    ]);

    expect(data.map((user) => user.role)).toEqual(['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER']);
    expect(data.every((user) => user.isActive)).toBe(true);

    for (const user of data) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'isActive', 'name', 'role']);
    }
  });
  // 7. deactivated user        -> prisma.user.update({ where: { email }, data:
  //                               { isActive: false } }) then login -> 401
  //                               (import the prisma client from src/db/prisma.js)
  it('rejects login for a deactivated user', async () => {
    const email = SEEDED_USERS.pharmacist;

    await prisma.user.update({
      where: { email },
      data: { isActive: false }
    });

    try {
      const response = await api()
        .post('/api/v1/auth/login')
        .send({ email, password: DEMO_PASSWORD });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: { code: 'UNAUTHENTICATED' }
      });
    } finally {
      // Later tests log in as this user — never leave it disabled.
      await prisma.user.update({ where: { email }, data: { isActive: true } });
    }
  });

  it('invalidates an existing token when the user is deactivated', async () => {
    const email = SEEDED_USERS.pharmacist;
    const token = await loginAs(email); // token issued while active

    await prisma.user.update({ where: { email }, data: { isActive: false } });

    try {
      const me = await api().get('/api/v1/auth/me').set('Authorization', bearer(token));

      expect(me.status).toBe(401);
      expect(me.body).toMatchObject({ error: { code: 'UNAUTHENTICATED' } });
    } finally {
      await prisma.user.update({ where: { email }, data: { isActive: true } });
    }
  });
});
