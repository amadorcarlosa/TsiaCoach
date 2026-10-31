import { test, expect } from './fixtures/playground-fixture'

test.describe('Array negative rods', () => {
  test('creates a negative ten with the positive footprint, a recessed cap and a signed label', async ({ playground, page }) => {
    const panel = await playground.show('Array')
    const toggle = panel.getByRole('button', { name: 'Negative rods', exact: true })
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    const positive = await playground.add('Array', 'ten')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByText('New rods: negative')).toBeVisible()

    const negative = await playground.add('Array', 'negative ten')
    await expect(negative).toHaveAttribute('aria-label', /^Negative 10 rod at column/)
    await expect(negative.locator('[data-rod-surface]')).toHaveText('−10')
    await expect(negative.locator('.rod')).toHaveAttribute('data-rod-sign', 'negative')

    // Same palette and footprint: only the cap differs.
    const size = (rod: typeof positive) => rod.evaluate(el => ({
      width: (el as HTMLElement).style.width,
      height: (el as HTMLElement).style.height,
      fill: getComputedStyle(el.querySelector('.rod')!).getPropertyValue('--fill'),
    }))
    expect(await size(negative)).toEqual(await size(positive))
    const shadow = await negative.locator('[data-rod-surface]').evaluate(el => getComputedStyle(el).boxShadow)
    expect(shadow).toContain('inset')

    await expect(panel.getByText('Signed total 0', { exact: false })).toBeVisible()
    await negative.locator('[data-rod-surface]').click()
    await page.screenshot({ path: 'output/playwright/negative-rods/positive-and-negative-ten.png' })
  })

  test('regroups a negative train into same-sign addends', async ({ playground, page }) => {
    const panel = await playground.show('Array')
    await panel.getByRole('button', { name: 'Negative rods', exact: true }).click()
    const rod = await playground.add('Array', 'negative eight')

    const menu = await playground.menu(rod)
    await menu.getByRole('menuitem', { name: 'Regroup to addends' }).hover()
    await menu.getByRole('menuitem', { name: '(−4) + (−4)', exact: true }).click()

    const pieces = panel.locator('[data-piece-id]')
    await expect(pieces).toHaveCount(2)
    for (const piece of await pieces.all()) {
      await expect(piece).toHaveAttribute('aria-label', /^Negative 4 rod/)
    }
    await expect(panel.getByText('Signed total −8', { exact: false })).toBeVisible()
    await page.screenshot({ path: 'output/playwright/negative-rods/negative-addends.png' })
  })
})
