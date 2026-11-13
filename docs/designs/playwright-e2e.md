# Playwright E2E Test Suite — Design Spec

**Status:** Specced, ready for scaffold
**Date:** 2026-11-13
**Effort:** ~4-6 hours for scaffold + first 10 tests

## Purpose

End-to-end tests for the critical user flows. These are the paths where a
failure costs the business: a recruiter can't submit a vacature, an owner
can't approve and publish, the XML feed doesn't update.

## Architecture

```
light-marketing-tool/
├── e2e/
│   ├── fixtures/
│   │   └── auth.js            # login helper, cookie injection
│   ├── tests/
│   │   ├── auth.spec.js       # login, logout, session, roles
│   │   ├── vacature.spec.js   # create → generate → approve → feed
│   │   ├── marketing.spec.js  # create → generate → approve → publish
│   │   ├── queue.spec.js      # filter, approve, reject, bulk
│   │   ├── published.spec.js  # list, close vacature
│   │   └── settings.spec.js   # brand, users
│   └── helpers/
│       └── seed.js            # API-based test data seeding
├── playwright.config.js
└── package.json               # root package with playwright dep
```

## Configuration

```js
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'cd backend && npm run dev',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd frontend && npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

## Auth helper

```js
// e2e/fixtures/auth.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', process.env.E2E_OWNER_EMAIL);
    await page.fill('input[name="password"]', process.env.E2E_OWNER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await use(page);
  },
});
```

## Critical path tests (30 tests across 6 files)

### auth.spec.js (6 tests)
1. Login with valid credentials → redirects to dashboard
2. Login with invalid credentials → shows error
3. Logout → redirects to login, clears cookie
4. Session persists on page reload
5. Recruiter cannot access /gebruikers → access denied
6. Viewer cannot access /merk-instellingen → access denied

### vacature.spec.js (7 tests)
7. Create vacature draft with all required fields
8. Generate content → shows NL omschrijving
9. Generate with PL selected → shows PL tab
10. Edit generated content → changes persist (autosave)
11. Submit for approval → status changes to pending
12. Owner approves → status changes to actief
13. Actief vacature appears in XML feed (/feeds/jobs.xml)

### marketing.spec.js (6 tests)
14. Create marketing post with topic and channels
15. Generate content → shows LinkedIn/Facebook/Instagram text
16. Image preview renders (Satori output)
17. Owner can upload override image
18. Approve → status changes (mock Buffer for E2E)
19. Published post appears in Gepubliceerd page

### queue.spec.js (5 tests)
20. Filter by status shows correct drafts
21. Filter by type shows correct drafts
22. Owner approves from queue → status updates optimistically
23. Owner rejects from queue → shows reject comment dialog
24. Bulk approve multiple drafts

### published.spec.js (3 tests)
25. Published vacatures listed with correct status
26. Close vacature → status changes to expired
27. Closed vacature no longer in XML feed

### settings.spec.js (3 tests)
28. Owner can update brand settings
29. Owner can add a new user
30. Last owner cannot be deleted

## Test data strategy

- Use a dedicated test database (or test Supabase project)
- Seed via API calls in `beforeAll` (POST /api/auth/login + create drafts)
- Clean up via API calls in `afterAll`
- Buffer API calls mocked via route interception (`page.route()`)

## Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## Environment

```
E2E_OWNER_EMAIL=owner@test.local
E2E_OWNER_PASSWORD=TestWachtwoord123
E2E_BASE_URL=http://localhost:5173
```

## Risks

- **External API calls**: Buffer API must be mocked in E2E (use `page.route()` to intercept)
- **AI generation**: Claude API calls are slow; mock or use a pre-generated fixture
- **Database state**: Tests must not depend on previous test data; seed fresh per suite
- **Port conflicts**: Dev servers need free ports 3001 + 5173
