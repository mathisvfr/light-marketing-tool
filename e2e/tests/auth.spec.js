import { test, expect } from '@playwright/test';
import { test as authTest } from '../fixtures/auth.js';

const EMAIL = process.env.E2E_OWNER_EMAIL || 'owner@example.com';
const PASSWORD = process.env.E2E_OWNER_PASSWORD || 'GeheimWachtwoord123';

test.describe('Authenticatie', () => {
  test('inloggen met geldige gegevens → dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('inloggen met ongeldige gegevens → foutmelding', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByLabel('Wachtwoord').fill('fout-wachtwoord');
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page.getByText('Ongeldige inloggegevens')).toBeVisible();
  });

  test('uitloggen → terug naar login', async ({ page }) => {
    // First log in
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page).toHaveURL('/');

    // Then log out
    await page.getByRole('button', { name: 'Uitloggen' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('sessie blijft bestaan na pagina-herlaad', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(EMAIL);
    await page.getByLabel('Wachtwoord').fill(PASSWORD);
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page).toHaveURL('/');

    await page.reload();
    await expect(page).toHaveURL('/');
    await expect(page.getByText('Dashboard')).toBeVisible();
  });

  test('onbeveiligde route redirect naar login', async ({ page }) => {
    await page.goto('/content-wachtrij');
    await expect(page).toHaveURL('/login');
  });
});

// Role enforcement tests need a recruiter/viewer account.
// These are placeholder specs — implement when test seeding is ready.
test.describe.skip('Rolafscherming', () => {
  test('recruiter kan /gebruikers niet bereiken', async ({ page }) => {
    // TODO: Login as recruiter, navigate to /gebruikers, expect access denied
  });

  test('viewer kan /merk-instellingen niet bereiken', async ({ page }) => {
    // TODO: Login as viewer, navigate to /merk-instellingen, expect access denied
  });
});
