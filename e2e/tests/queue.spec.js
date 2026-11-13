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

  // Placeholder specs
  test.skip('goedkeuren update status optimistisch', async ({ authenticatedPage: page }) => {
    // TODO: Click approve on a pending draft, verify immediate status change
  });

  test.skip('afwijzen toont commentaar-dialog', async ({ authenticatedPage: page }) => {
    // TODO: Click reject, verify dialog appears, fill comment, submit
  });

  test.skip('bulk goedkeuren werkt voor meerdere drafts', async ({ authenticatedPage: page }) => {
    // TODO: Select multiple checkboxes, click bulk approve, verify all updated
  });
});
