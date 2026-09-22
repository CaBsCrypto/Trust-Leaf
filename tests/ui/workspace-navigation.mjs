export async function navigateSection(page, name) {
  const tab = page.getByRole('tab', { name, exact: true, includeHidden: true });
  await tab.waitFor({ state: 'attached' });
  if (!await tab.isVisible()) await page.locator('.op-mobile-menu').click();
  await tab.click();
}
