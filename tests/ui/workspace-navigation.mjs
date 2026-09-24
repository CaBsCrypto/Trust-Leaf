export async function navigateSection(page, name) {
  if (await page.locator('.op-dispensary').count()) name = ({ Inicio: 'Jornada', Atenciones: 'Pacientes' })[name] ?? name;
  const tab = page.getByRole('tab', { name, exact: true, includeHidden: true });
  await tab.waitFor({ state: 'attached' });
  await tab.click();
}
