import type { Page } from '@playwright/test';

// Existing interaction scenarios explicitly reveal the lists they use. Tests
// of default collapsed states deliberately do not call this helper.
export async function openLibrarySections(page: Page) {
  const library = page.getByRole('complementary', { name: 'Component library', exact: true });
  const wasVisible = await library.isVisible();
  if (!wasVisible) await page.getByRole('button', { name: 'Toggle component library' }).click();
  for (const name of ['Boards', 'Power', 'Basic components', 'Logic ICs', 'On the workplane', 'Jumper wires']) {
    const button = library.getByRole('button', { name, exact: true });
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
  }
  if (!wasVisible) await library.getByRole('button', { name: 'Close component library', exact: true }).click();
}
