import { test, expect } from './fixtures/playground-fixture'
for (const kind of ['Bar', 'Array', 'Fraction', 'MathTabla'] as const) {
  test(`${kind} goal editing preserves dirty board and guards drafts on switching`, async ({ playground: p, page }) => {
    const panel = await p.show(kind)
    await p.add(kind, 'two')
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await p.add(kind, 'one')
    await panel.getByRole('button', { name: 'Add condition', exact: true }).click()
    await panel.getByRole('combobox', { name: 'Condition type', exact: true }).selectOption('occupied-area')
    await panel.getByLabel('Cells', { exact: true }).fill('3')
    await panel.getByRole('button', { name: 'Apply goal', exact: true }).click()
    await expect(panel.getByRole('button', { name: 'Update step', exact: true })).toBeEnabled()
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await panel.getByRole('button', { name: 'Step 1', exact: true }).click()
    await expect(panel.getByLabel('Cells', { exact: true })).toHaveValue('3')
    await expect(panel.locator('[data-piece-id]')).toHaveCount(1)
    await panel.getByLabel('Cells', { exact: true }).fill('4')
    page.once('dialog', dialog => dialog.dismiss())
    await panel.getByRole('button', { name: 'Step 2', exact: true }).click()
    await expect(panel.getByLabel('Cells', { exact: true })).toHaveValue('4')
    page.once('dialog', dialog => dialog.accept())
    await panel.getByRole('button', { name: 'Step 2', exact: true }).click()
    await expect(panel.getByText('No goal authored.', { exact: true })).toBeVisible()
  })
}

