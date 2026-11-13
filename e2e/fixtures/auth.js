import { test as base, expect } from '@playwright/test';

/**
 * Custom test fixtures providing authenticated pages for each role.
 *
 * Uses API login (POST /api/auth/login) instead of filling the UI form —
 * this is ~5x faster and avoids coupling tests to the login page markup.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *   test('my test', async ({ ownerPage }) => { ... });
 *   test('recruiter test', async ({ recruiterPage }) => { ... });
 */

const TEST_USERS = {
  owner: {
    email: process.env.E2E_OWNER_EMAIL || 'owner@example.com',
    password: process.env.E2E_OWNER_PASSWORD || 'GeheimWachtwoord123',
  },
  recruiter: {
    email: process.env.E2E_RECRUITER_EMAIL || 'recruiter@example.com',
    password: process.env.E2E_RECRUITER_PASSWORD || 'GeheimWachtwoord123',
  },
  viewer: {
    email: process.env.E2E_VIEWER_EMAIL || 'viewer@example.com',
    password: process.env.E2E_VIEWER_PASSWORD || 'GeheimWachtwoord123',
  },
};

async function loginViaApi(page, email, password) {
  const baseUrl = process.env.E2E_API_URL || 'http://localhost:3001';
  const response = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`Login failed for ${email}: ${response.status()}`);
  }
  return (await response.json()).user;
}

export const test = base.extend({
  ownerPage: async ({ page }, use) => {
    await loginViaApi(page, TEST_USERS.owner.email, TEST_USERS.owner.password);
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
    await use(page);
  },

  recruiterPage: async ({ page }, use) => {
    await loginViaApi(page, TEST_USERS.recruiter.email, TEST_USERS.recruiter.password);
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
    await use(page);
  },

  viewerPage: async ({ page }, use) => {
    await loginViaApi(page, TEST_USERS.viewer.email, TEST_USERS.viewer.password);
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
    await use(page);
  },

  // Backward compat: authenticatedPage = owner
  authenticatedPage: async ({ page }, use) => {
    await loginViaApi(page, TEST_USERS.owner.email, TEST_USERS.owner.password);
    await page.goto('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
    await use(page);
  },
});

export { expect, loginViaApi, TEST_USERS };
