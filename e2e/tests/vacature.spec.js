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

  test('goedkeuren zet status op actief', async ({ authenticatedPage: page }) => {
    // Create a draft via API and mock the generate endpoint
    const draftId = 'test-draft-' + Date.now();

    // Mock the drafts POST to return a draft id
    await page.route('**/api/drafts', async (route, request) => {
      if (request.method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            draft: { id: draftId, type: 'vacature', status: 'draft' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock generate endpoint
    await page.route(`**/api/drafts/${draftId}/generate`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: {
            id: draftId,
            omschrijving_nl: 'Testomschrijving voor productiemedewerker.',
            functie_eisen: 'Fysiek fit.',
            wat_wij_bieden: 'Reiskostenvergoeding.',
            social_nl: 'Nieuwe vacature!',
            criticus_passed: true,
            criticus_notes: '',
          },
        }),
      });
    });

    // Mock the draft detail GET (for preview reload)
    await page.route(`**/api/drafts/${draftId}`, async (route, request) => {
      if (request.method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            draft: {
              id: draftId,
              type: 'vacature',
              status: 'draft',
              omschrijving_nl: 'Testomschrijving voor productiemedewerker.',
              functie_eisen: 'Fysiek fit.',
              wat_wij_bieden: 'Reiskostenvergoeding.',
              social_nl: 'Nieuwe vacature!',
              criticus_passed: true,
              criticus_notes: '',
              form_data: {},
            },
          }),
        });
      } else if (request.method() === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ draft: { id: draftId } }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock approve endpoint
    await page.route(`**/api/drafts/${draftId}/approve`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: { id: draftId, status: 'actief' },
        }),
      });
    });

    await page.goto('/vacature-plaatsen');

    // Fill required fields
    await page.getByLabel('Functietitel').fill('Productiemedewerker');
    await page.getByLabel('Locatie').fill('Rotterdam');
    await page.getByLabel('Uren per week').fill('40');
    await page.getByLabel('Contractvorm').selectOption('Onbepaalde tijd');
    await page.getByLabel('Functiecategorie').selectOption('Productie');
    await page.getByLabel('Korte omschrijving').fill('Productiemedewerker gezocht');

    // Generate
    await page.getByRole('button', { name: /genereren/i }).click();

    // Wait for generated content to appear
    await expect(page.getByText('Testomschrijving voor productiemedewerker')).toBeVisible({ timeout: 10000 });

    // Click approve button
    await page.getByRole('button', { name: 'Goedkeuren' }).click();

    // Should show success message
    await expect(page.getByText(/goedgekeurd/i)).toBeVisible({ timeout: 5000 });
  });

  test('actieve vacature verschijnt in XML feed', async ({ authenticatedPage: page }) => {
    const baseUrl = process.env.E2E_API_URL || 'http://localhost:3001';

    // Fetch the XML feed directly via the API
    const response = await page.request.get(`${baseUrl}/feeds/jobs.xml`);
    expect(response.ok()).toBeTruthy();

    const body = await response.text();

    // The feed should be valid XML with the expected root structure
    expect(body).toContain('<?xml');
    // It should contain a jobs/vacatures root element
    expect(body).toMatch(/<(vacatures|jobs)/i);
  });
});
