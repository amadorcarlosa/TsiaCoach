import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures/playground-fixture'

const shots = 'output/playwright/zero-pair-cancellation'

/** Adds +positive and -negative rods, then selects both with a shift-click. */
async function pair(
  playground: { show: (kind: 'Array') => Promise<Locator>, add: (kind: 'Array', name: string) => Promise<Locator> },
  positive: string,
  negative: string,
) {
  const panel = await playground.show('Array')
  const plus = await playground.add('Array', positive)
  await panel.getByRole('button', { name: 'Negative rods', exact: true }).click()
  const minus = await playground.add('Array', `negative ${negative}`)
  await panel.getByRole('button', { name: 'Negative rods', exact: true }).click()
  await plus.locator('[data-rod-surface]').click({ modifiers: ['Shift'] })
  await expect(plus).toHaveClass(/--selected/)
  await expect(minus).toHaveClass(/--selected/)
  return { panel, plus, minus }
}

async function openPreview(page: Page, rod: Locator, label: string) {
  await rod.locator('[data-rod-surface]').click({ button: 'right' })
  const menu = page.getByRole('menu')
  await menu.getByRole('menuitem', { name: label }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('zero-pair cancellation', () => {
  test('equal pair: Escape keeps the rods, confirming removes both', async ({ playground, page }) => {
    const { panel, plus, minus } = await pair(playground, 'four', 'four')

    let dialog = await openPreview(page, minus, 'Cancel zero pair')
    await expect(dialog.getByRole('heading', { name: 'Cancel zero pair' })).toBeVisible()
    await expect(dialog.getByRole('listitem')).toHaveText(['4 + (−4) = 0'])
    await expect(dialog).toContainText('Positive 4 and negative 4 make zero. No rods remain.')
    // The safe choice has focus; both rods are marked as the zero pair.
    await expect(dialog.getByRole('button', { name: 'Keep rods' })).toBeFocused()
    await expect(plus.locator('[data-preview-role="cancelling"]')).toHaveCount(1)
    await expect(minus.locator('[data-preview-role="cancelling"]')).toHaveCount(1)
    await page.screenshot({ path: `${shots}/equal-preview.png` })

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
    await expect(panel.locator('[data-preview-role]')).toHaveCount(0)

    dialog = await openPreview(page, minus, 'Cancel zero pair')
    await dialog.getByRole('button', { name: 'Cancel pair' }).click()
    await expect(dialog).toBeHidden()
    await expect(panel.locator('[data-piece-id]')).toHaveCount(0)
    await expect(panel.getByRole('status').filter({ hasText: 'Zero pair cancelled. No rods remain.' })).toBeVisible()
    await expect(panel.getByText('Signed total 0', { exact: false })).toBeVisible()
  })

  test('unequal pair: previews 10 = 6 + 4 and leaves +6 on the same train', async ({ playground, page }) => {
    const { panel, plus, minus } = await pair(playground, 'ten', 'four')
    const id = await plus.getAttribute('data-piece-id')

    const dialog = await openPreview(page, plus, 'Find a zero pair')
    await expect(dialog.getByRole('listitem')).toHaveText(['10 = 6 + 4', '6 + [4 + (−4)] = 6'])
    await expect(dialog).toContainText(
      'Split positive 10 into positive 6 and positive 4. Positive 4 and negative 4 make zero. Positive 6 will remain.')
    await expect(plus.locator('[data-preview-role="remainder"]')).toHaveAttribute('data-part-value', '6')
    await expect(plus.locator('[data-preview-role="cancelling"]')).toHaveAttribute('data-part-value', '4')
    await expect(minus.locator('[data-preview-role="cancelling"]')).toHaveCount(1)
    // The ghosts are decoration: still two objects, still +10 and -4.
    await expect(panel.getByText('2 objects on the board', { exact: false })).toBeVisible()
    await expect(plus).toHaveAttribute('aria-label', /^10-rod/)
    await page.screenshot({ path: `${shots}/unequal-preview.png` })

    await dialog.getByRole('button', { name: 'Cancel pair' }).click()
    const pieces = panel.locator('[data-piece-id]')
    await expect(pieces).toHaveCount(1)
    await expect(pieces.first()).toHaveAttribute('data-piece-id', id!)
    await expect(pieces.first()).toHaveAttribute('aria-label', /^6-rod/)
    await expect(pieces.first()).toHaveClass(/--selected/)
    await expect(pieces.first()).toBeFocused()
    await expect(panel.getByRole('status').filter({ hasText: 'Zero pair cancelled. Positive 6 remains.' })).toBeVisible()
    await page.screenshot({ path: `${shots}/unequal-result.png` })
  })

  test('negative larger: keyboard confirmation leaves a concave -6', async ({ playground, page }) => {
    const { panel, minus } = await pair(playground, 'four', 'ten')

    await minus.focus()
    await minus.press('Shift+F10')
    await page.getByRole('menu').getByRole('menuitem', { name: 'Find a zero pair' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('listitem')).toHaveText(['−10 = (−6) + (−4)', '(−6) + [4 + (−4)] = −6'])
    await page.screenshot({ path: `${shots}/negative-preview.png` })

    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Cancel pair' })).toBeFocused()
    await page.keyboard.press('Enter')

    const survivor = panel.locator('[data-piece-id]')
    await expect(survivor).toHaveCount(1)
    await expect(survivor).toHaveAttribute('aria-label', /^Negative 6 rod/)
    await expect(survivor.locator('.rod')).toHaveAttribute('data-rod-sign', 'negative')
    await expect(panel.getByText('Signed total −6', { exact: false })).toBeVisible()
    await page.screenshot({ path: `${shots}/negative-result.png` })
  })

  test('the menu entry explains why one rod or two positives cannot cancel', async ({ playground, page }) => {
    const panel = await playground.show('Array')
    const first = await playground.add('Array', 'four')
    await first.locator('[data-rod-surface]').click({ button: 'right' })
    const item = page.getByRole('menu').getByRole('menuitem', { name: /Cancel zero pair/ })
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('Select exactly two rods')
    await page.keyboard.press('Escape')
    await expect(panel.locator('[data-piece-id]')).toHaveCount(1)
  })

  test('losing window focus dismisses the preview without changing anything', async ({ playground, page }) => {
    const { panel } = await pair(playground, 'ten', 'four')
    const dialog = await openPreview(page, panel.locator('[data-piece-id]').first(), 'Find a zero pair')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await expect(dialog).toBeHidden()
    await expect(panel.locator('[data-preview-role]')).toHaveCount(0)
    await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
  })

  for (const zoom of ['0.25', '0.5', '1', '2']) {
    test(`ghost pieces follow the rod at ${Number(zoom) * 100}% zoom on a scrolled board`, async ({ playground, page }) => {
      const panel = await playground.show('Array')
      await panel.getByRole('spinbutton', { name: 'Columns' }).fill('200')
      await panel.getByRole('spinbutton', { name: 'Rows' }).fill('100')
      await panel.getByRole('button', { name: 'Resize board' }).click()
      const { plus } = await pair(playground, 'ten', 'four')
      // Move the selected pair off the left edge, so after scrolling the
      // clicked rod is fully in view and focusing it does not scroll again.
      await plus.focus()
      for (let step = 0; step < 4; step++) await plus.press('ArrowRight')
      await expect(plus).toHaveAttribute('aria-label', /column 4, row 0/)
      await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)

      // Scroll a few cells so the rods sit at a nonzero viewport offset.
      const viewport = panel.locator('.array-viewport')
      await viewport.evaluate(element => {
        const world = element.querySelector<HTMLElement>('[data-grid-world]')!
        const cell = parseFloat(getComputedStyle(world).getPropertyValue('--cell-size'))
        element.scrollLeft = cell * 2
        // Zoom keeps the view centred, which can scroll row 0 partly out.
        element.scrollTop = 0
      })
      await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)

      await openPreview(page, plus, 'Find a zero pair')
      const rodBox = (await plus.boundingBox())!
      const remainder = (await plus.locator('.preview-mark--remainder').boundingBox())!
      const cancelling = (await plus.locator('.preview-mark--cancelling').boundingBox())!
      const cell = rodBox.width / 10
      // Six cells then four, side by side, over the rod's own footprint.
      expect(remainder.width / cancelling.width).toBeCloseTo(1.5, 1)
      expect(cancelling.x - remainder.x).toBeCloseTo(remainder.width, 0)
      for (const mark of [remainder, cancelling]) {
        expect(mark.x).toBeGreaterThanOrEqual(rodBox.x - cell)
        expect(mark.x + mark.width).toBeLessThanOrEqual(rodBox.x + rodBox.width + cell)
      }
      await page.screenshot({ path: `${shots}/zoom-${zoom}.png` })
      await page.keyboard.press('Escape')
      await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
    })
  }
})
