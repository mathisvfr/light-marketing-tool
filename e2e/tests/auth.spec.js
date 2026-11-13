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
// These use the auth fixture's role-specific pages.
test.describe('Rolafscherming', () => {
  authTest('recruiter kan /gebruikers niet bereiken', async ({ recruiterPage }) => {
    await recruiterPage.goto('/gebruikers');

    // Should see an access-denied message (RoleRoute renders this)
    await expect(recruiterPage.getByText('Je hebt geen toegang tot deze pagina')).toBeVisible();
  });

  authTest('viewer kan /merk-instellingen niet bereiken', async ({ viewerPage }) => {
    await viewerPage.goto('/merk-instellingen');

    // Should see an access-denied message
    await expect(viewerPage.getByText('Je hebt geen toegang tot deze pagina')).toBeVisible();
  });
});
