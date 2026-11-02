import { test, expect } from '@playwright/test'
import { Touch } from './fixtures/playground-fixture'

test.use({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' })
test.beforeEach(async ({ page }) => {
  await page.goto('/dev/rod-zero-plane-interactive')
  await expect(page.locator('.interactive-study[data-ready="true"]')).toBeVisible()
})

for (const zoom of ['0.25', '0.5', '1', '2']) {
  test(`negative floor drag snaps on the zero plane at zoom ${zoom}`, async ({ page }) => {
    await page.getByLabel('Zoom', { exact: true }).selectOption(zoom)
    const rod = page.locator('[data-piece-id="negative-4"]')
    await rod.scrollIntoViewIfNeeded()
    const surface = rod.locator('[data-rod-surface]')
    const box = await surface.boundingBox()
    if (!box) throw new Error('No negative surface')
    const axes = await page.locator('[data-grid-world]').evaluate(el => {
      const read = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const o = read('origin'), x = read('x'), y = read('y')
      return { x: x.left - o.left, y: y.top - o.top }
    })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + axes.x * 2.2, box.y + box.height / 2 + axes.y * 1.2, { steps: 12 })
    await page.mouse.up()
    await expect(rod).toHaveAttribute('aria-label', /column 21, row 7/)
    await expect(page.locator('[data-piece-id]')).toHaveCount(8)
    await expect(page.getByRole('status')).toContainText('signed total 0')
  })
}

test('negative trains keep signs through keyboard menu operations', async ({ page }) => {
  const train = page.locator('[data-piece-id="negative-train"]')
  await train.focus()
  await train.press('Shift+F10')
  await page.getByRole('menuitem', { name: 'Regroup to addends', exact: true }).hover()
  await page.getByRole('menuitem', { name: '(−7) + (−7)', exact: true }).click()
  await expect(train).toHaveCount(0)
  await expect(page.locator('[data-piece-id]')).toHaveCount(9)
  const sevens = page.locator('[data-part-sign="-1"][data-part-value="7"]')
  await expect(sevens).toHaveCount(2)
  const first = page.locator('[data-piece-id]').filter({ has: page.locator('[data-part-sign="-1"][data-part-value="7"]') }).first()
  await first.focus()
  await page.keyboard.press('ArrowDown')
  await expect(first).toHaveAttribute('aria-label', /row 14/)
})

test('view changes keep magnitudes and constant depth across rods', async ({ page }) => {
  const one = page.locator('[data-piece-id="negative-1"] .cap')
  const ten = page.locator('[data-piece-id="negative-10"] .cap')
  const z = (locator: typeof one) => locator.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m43)
  expect(await z(one)).toBe(-36)
  expect(await z(ten)).toBe(-36)
  await page.getByLabel('Rod depth').fill('20')
  await expect.poll(() => z(one)).toBe(-20)
  expect(await z(ten)).toBe(-20)
  await page.getByLabel('Board tilt').fill('0')
  await page.getByLabel('Transparent grid').uncheck()
  await expect(page.locator('[data-piece-id]')).toHaveCount(8)
  await expect(page.locator('.backing')).not.toHaveClass(/transparent/)
  await expect(page.getByRole('status')).toContainText('signed total 0')
  await page.getByRole('button', { name: 'Reset sample rods', exact: true }).click()
  await expect(page.locator('[data-piece-id="negative-4"]')).toHaveAttribute('aria-label', /column 19, row 6/)
})


test('a recessed train moves as one object and its solid-grid cutout follows the preview', async ({ page }) => {
  await page.getByLabel('Transparent grid').uncheck()
  const train = page.locator('[data-piece-id="negative-train"]')
  await train.scrollIntoViewIfNeeded()
  const initialCutout = await page.locator('.backing').evaluate(el => (el as HTMLElement).style.clipPath)
  const surface = train.locator('[data-rod-surface]').first()
  const box = await surface.boundingBox()
  if (!box) throw new Error('No train surface')
  const dy = await page.locator('[data-grid-world]').evaluate(el => {
    const origin = el.querySelector('[data-grid-axis="origin"]')!.getBoundingClientRect()
    return el.querySelector('[data-grid-axis="y"]')!.getBoundingClientRect().top - origin.top
  })
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 62, box.y + box.height / 2 + dy * 2, { steps: 12 })
  await expect.poll(() => page.locator('.backing').evaluate(el => (el as HTMLElement).style.clipPath)).not.toBe(initialCutout)
  await page.mouse.up()
  await expect(train).toHaveAttribute('aria-label', /column 20, row 15/)
  await expect(train.locator('[data-zero-sign="-1"]')).toHaveCount(2)
  expect(await train.locator('[data-train-part]').evaluateAll(els => els.map(el => (el as HTMLElement).style.left))).toEqual(['0px', '320px'])
})

test('changing the view cancels a held gesture without changing scene positions', async ({ page }) => {
  const rod = page.locator('[data-piece-id="positive-4"]')
  const box = await rod.locator('[data-rod-surface]').boundingBox()
  if (!box) throw new Error('No surface')
  await page.mouse.move(box.x + 30, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + 100, box.y + box.height / 2 + 40, { steps: 8 })
  await page.getByLabel('Board tilt').fill('45')
  await page.mouse.up()
  await expect(rod).toHaveAttribute('aria-label', /column 2, row 6/)
  await expect(page.getByRole('status')).toContainText('signed total 0')
})


test.describe('touch zero-plane input', () => {
  test.use({ contextOptions: { hasTouch: true, reducedMotion: 'reduce' } })
  test('long press on the recessed input surface opens its real train menu', async ({ page }) => {
    const rod = page.locator('[data-piece-id="negative-4"]')
    const box = await rod.locator('[data-rod-surface]').boundingBox()
    if (!box) throw new Error('No touch surface')
    const touch = new Touch(page)
    await touch.down(1, { x: box.x + box.width / 2, y: box.y + box.height / 2 })
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 2500 })
    await touch.up(1)
    await expect(rod).toHaveClass(/--selected/)
    await page.getByRole('menuitem', { name: 'Clone', exact: true }).tap()
    await expect(page.locator('[data-piece-id]')).toHaveCount(9)
    await expect(page.getByRole('status')).toContainText('signed total -4')
  })
})
