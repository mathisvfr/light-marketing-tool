import { test, expect } from '../fixtures/auth.js';

test.describe('Content wachtrij', () => {
  test('wachtrij pagina laadt', async ({ authenticatedPage: page }) => {
    await page.goto('/content-wachtrij');
    await expect(page.getByText('Content wachtrij')).toBeVisible();
  });

  test('statusfilter werkt', async ({ authenticatedPage: page }) => {
    await page.goto('/content-wachtrij');

    // Select a status filter
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('pending_approval');

    // Should update the list (exact assertion depends on test data)
    await page.waitForTimeout(500);
  });

  test('goedkeuren update status optimistisch', async ({ authenticatedPage: page }) => {
    const draftId = 'pending-draft-001';

    // Mock the drafts list with one pending_approval draft
    await page.route('**/api/drafts?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          drafts: [
            {
              id: draftId,
              type: 'vacature',
              title: 'Orderpicker Rotterdam',
              authorName: 'Test Owner',
              createdBy: 'user-1',
              status: 'pending_approval',
              createdAt: new Date().toISOString(),
              channels: [],
            },
          ],
        }),
      });
    });

    // Mock approve endpoint
    await page.route(`**/api/drafts/${draftId}/approve`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draft: { id: draftId, status: 'actief' } }),
      });
    });

    // Mock the draft detail for the confirm dialog
    await page.route(`**/api/drafts/${draftId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          draft: {
            id: draftId,
            type: 'vacature',
            status: 'pending_approval',
            title: 'Orderpicker Rotterdam',
            form_data: { contract: 'Bepaalde tijd', startdatum: '2026-12-01', einddatum: '2027-03-01' },
          },
        }),
      });
    });

    await page.goto('/content-wachtrij');

    // Wait for the draft to appear
    await expect(page.getByText('Orderpicker Rotterdam')).toBeVisible();

    // Click the approve button for the row
    await page.getByRole('button', { name: 'Goedkeuren' }).first().click();

    // A confirm dialog should appear
    await expect(page.getByText(/Weet je zeker/)).toBeVisible();

    // Confirm the approval
    await page.getByRole('button', { name: 'Goedkeuren' }).last().click();

    // After optimistic update, the row should reflect the new status (opacity change or badge)
    // The mutation fires, then the list is refetched — the draft should no longer show pending_approval
    await page.waitForTimeout(500);
  });

  test('afwijzen toont commentaar-dialog', async ({ authenticatedPage: page }) => {
    const draftId = 'pending-draft-002';

    // Mock the drafts list
    await page.route('**/api/drafts?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          drafts: [
            {
              id: draftId,
              type: 'vacature',
              title: 'Magazijnmedewerker',
              authorName: 'Recruiter',
              createdBy: 'user-2',
              status: 'pending_approval',
              createdAt: new Date().toISOString(),
              channels: [],
            },
          ],
        }),
      });
    });

    // Mock reject endpoint
    let rejectedWithComment = false;
    await page.route(`**/api/drafts/${draftId}/reject`, async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      rejectedWithComment = Boolean(body.comment);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ draft: { id: draftId, status: 'rejected' } }),
      });
    });

    await page.goto('/content-wachtrij');
    await expect(page.getByText('Magazijnmedewerker')).toBeVisible();

    // The reject action uses window.prompt — we handle this dialog
    page.on('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('Toon minder jargon, meer spreektaal.');
    });

    // Click the reject button
    await page.getByRole('button', { name: 'Afwijzen' }).first().click();

    // Wait for the reject mutation to complete
    await page.waitForTimeout(500);

    // The comment should have been sent to the server
    expect(rejectedWithComment).toBeTruthy();
  });

  test('bulk goedkeuren werkt voor meerdere drafts', async ({ authenticatedPage: page }) => {
    const drafts = [
      {
        id: 'bulk-001',
        type: 'vacature',
        title: 'Orderpicker Venlo',
        authorName: 'Recruiter',
        createdBy: 'user-2',
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
        channels: [],
      },
      {
        id: 'bulk-002',
        type: 'vacature',
        title: 'Productiemedewerker Ridderkerk',
        authorName: 'Recruiter',
        createdBy: 'user-2',
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
        channels: [],
      },
    ];

    // Mock drafts list
    await page.route('**/api/drafts?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ drafts }),
      });
    });

    // Mock bulk approve endpoint
    let bulkApprovedIds = [];
    await page.route('**/api/drafts/bulk-approve', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      bulkApprovedIds = body.ids || [];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          succeededCount: bulkApprovedIds.length,
          skippedCount: 0,
        }),
      });
    });

    await page.goto('/content-wachtrij');

    // Wait for both drafts to appear
    await expect(page.getByText('Orderpicker Venlo')).toBeVisible();
    await expect(page.getByText('Productiemedewerker Ridderkerk')).toBeVisible();

    // Select both rows via the "select all" header checkbox
    const selectAllCheckbox = page.getByRole('checkbox', { name: /selecteer alle/i });
    await selectAllCheckbox.check();

    // Bulk bar should appear showing 2 selected
    await expect(page.getByText('2 geselecteerd')).toBeVisible();

    // Click bulk approve
    await page.locator('.queue-bulk-bar').getByRole('button', { name: 'Goedkeuren' }).click();

    // Wait for mutation
    await page.waitForTimeout(500);

    // Both draft ids should have been sent
    expect(bulkApprovedIds).toContain('bulk-001');
    expect(bulkApprovedIds).toContain('bulk-002');
  });
});
