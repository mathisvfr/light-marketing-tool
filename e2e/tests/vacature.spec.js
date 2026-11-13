import { test, expect } from '../fixtures/auth.js';

test.describe('Vacature plaatsen', () => {
  test('formulier invullen en concept opslaan', async ({ authenticatedPage: page }) => {
    await page.goto('/vacature-plaatsen');

    await page.getByLabel('Functietitel').fill('Productiemedewerker');
    await page.getByLabel('Locatie').fill('Rotterdam');

    // Wait for autosave to trigger
    await page.waitForTimeout(2000);

    // Should show autosave indicator
    await expect(page.getByText('Opgeslagen')).toBeVisible({ timeout: 5000 });
  });

  test('content genereren toont NL omschrijving', async ({ authenticatedPage: page }) => {
    await page.goto('/vacature-plaatsen');

    await page.getByLabel('Functietitel').fill('Orderpicker');
    await page.getByLabel('Locatie').fill('Rotterdam');
    await page.getByLabel('Korte omschrijving').fill('Orderpicken in magazijn, fysiek werk');

    // Mock the AI generation endpoint for speed
    await page.route('**/api/drafts/*/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          omschrijving_nl: 'Wij zoeken een orderpicker voor ons magazijn in Rotterdam.',
          functie_eisen: 'Fysiek fit, flexibel inzetbaar.',
          wat_wij_bieden: 'Vast contract na proeftijd, reiskostenvergoeding.',
          social_nl: 'Nieuwe vacature: Orderpicker in Rotterdam!',
          criticus: { passed: true, notes: '' },
        }),
      });
    });

    await page.getByRole('button', { name: /genereren/i }).click();

    // Should show generated content
    await expect(page.getByText('Wij zoeken een orderpicker')).toBeVisible({ timeout: 15000 });
  });

  // Placeholder specs for the full vacature flow
  test.skip('goedkeuren zet status op actief', async ({ authenticatedPage: page }) => {
    // TODO: Create draft, generate, approve, verify status
  });

  test.skip('actieve vacature verschijnt in XML feed', async ({ authenticatedPage: page }) => {
    // TODO: After approval, fetch /feeds/jobs.xml and verify entry
  });
});
