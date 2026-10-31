import { test, expect } from '@playwright/test'
import { Touch } from './fixtures/playground-fixture'

const arrayName = 'Array Rod Playground'
const part = (value: number, x = 0) => ({ value, orientation: 'horizontal', offset: { x, y: 0 } })
const document = (trains: unknown[]) => ({ version: 1, board: { kind: 'array', config: { columns: 100, rows: 100 } }, steps: [{ id: 'step', title: 'Large board', prompt: '', goal: null, trains }] })

test.beforeEach(async ({ page }) => {
  await page.goto('/dev/playground')
  await expect(page.locator('[data-ready="true"]').first()).toBeVisible()
  await page.getByRole('tab', { name: arrayName, exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
})

for (const zoom of ['0.25', '0.5', '1', '2']) {
  test(`large HTML board snaps and opens menus at zoom ${zoom}`, async ({ page }) => {
    const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
    await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
      { id: 'long', anchor: { x: 2, y: 6 }, parts: [part(10), part(10, 10), part(10, 20)] },
      { id: 'five', anchor: { x: 2, y: 2 }, parts: [part(5)] },
    ]))) })
    await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
    await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
    await panel.getByRole('region', { name: /Board workspace/ }).evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0 })
    await page.evaluate(() => window.scrollTo(0, 0))
    const rod = panel.locator('[data-piece-id="five"]')
    await expect(rod).toHaveAttribute('aria-label', /column 2, row 2/)
    const axes = await panel.locator('[data-grid-world]').evaluate(el => {
      const read = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const o = read('origin'), x = read('x'), y = read('y')
      return { x: x.left - o.left, y: y.top - o.top }
    })
    const surface = rod.locator('[data-rod-surface]')
    const box = await surface.boundingBox()
    if (!box) throw new Error('Missing rod surface')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + axes.x * 3.2, box.y + box.height / 2 + axes.y * 1.2, { steps: 12 })
    await page.mouse.up()
    await expect(rod).toHaveAttribute('aria-label', /column 5, row 3/)
    await surface.click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Regroup to addends', exact: true }).hover()
    await page.getByRole('menuitem', { name: '2 + 3', exact: true }).click()
    await expect(panel.locator('[data-piece-id]')).toHaveCount(3)
    await expect(panel.locator('[data-piece-id="long"] .train-part')).toHaveCount(3)
    await expect(panel.locator('[data-piece-id="long"]')).toHaveAttribute('aria-label', /value 30/)
  })
}

test('pan, reset and resized level export preserve mathematical coordinates', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  await panel.getByRole('button', { name: 'Choose five rod', exact: true }).click()
  const rod = panel.locator('[data-piece-id]')
  const before = await rod.getAttribute('aria-label')
  const viewport = panel.getByRole('region', { name: /Board workspace/ })
  await panel.getByRole('button', { name: 'Pan board', exact: true }).click()
  const box = await viewport.boundingBox()
  if (!box) throw new Error('Missing viewport')
  await page.mouse.move(box.x + 350, box.y + 180)
  await page.mouse.down()
  await page.mouse.move(box.x + 150, box.y + 80, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
  await expect(rod).toHaveAttribute('aria-label', before!)
  await viewport.focus()
  const scroll = await viewport.evaluate(el => el.scrollTop)
  await page.keyboard.press('ArrowDown')
  await expect.poll(() => viewport.evaluate(el => el.scrollTop)).toBeGreaterThan(scroll)
  await panel.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect.poll(() => viewport.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  await expect(panel.getByLabel('Zoom', { exact: true })).toHaveValue('1')
  await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
  const pending = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Export level', exact: true }).click()
  const download = await pending
  const { readFile } = await import('node:fs/promises')
  const saved = JSON.parse(await readFile((await download.path())!, 'utf-8'))
  expect(saved.board.config).toEqual({ columns: 100, rows: 100 })
  expect(saved.steps[0].trains[0].anchor).toEqual({ x: 0, y: 0 })
})

test('shrinking checks saved steps even when the working board is empty', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
    { id: 'far', anchor: { x: 60, y: 60 }, parts: [part(10)] },
  ]))) })
  await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  const rod = panel.locator('[data-piece-id="far"]')
  await rod.scrollIntoViewIfNeeded()
  await rod.locator('[data-rod-surface]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Columns', { exact: true }).fill('24')
  await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Rows', { exact: true }).fill('12')
  await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
  await expect(panel).toContainText('Cannot resize:')
  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
})


test('marquee selection uses board coordinates after zoom and pan', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
    { id: 'one', anchor: { x: 20, y: 15 }, parts: [part(5)] },
    { id: 'two', anchor: { x: 27, y: 15 }, parts: [part(3)] },
  ]))) })
  await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  await panel.getByLabel('Zoom', { exact: true }).selectOption('0.5')
  await page.evaluate(() => window.scrollTo(0, 0))
  await panel.getByRole('region', { name: /Board workspace/ }).evaluate(el => { el.scrollLeft = 180; el.scrollTop = 180 })
  const bounds = await panel.locator('[data-grid-world]').evaluate(el => {
    const read = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
    const o = read('origin'), x = read('x'), y = read('y')
    return { x: o.left, y: o.top, dx: x.left - o.left, dy: y.top - o.top }
  })
  await page.mouse.move(bounds.x + bounds.dx * 19, bounds.y + bounds.dy * 14)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.dx * 31, bounds.y + bounds.dy * 17, { steps: 12 })
  await page.mouse.up()
  await expect(panel.locator('.draggable-rod--selected')).toHaveCount(2)
  const rod = panel.locator('[data-piece-id="one"]')
  await rod.focus()
  await page.keyboard.press('ArrowRight')
  await expect(rod).toHaveAttribute('aria-label', /column 21, row 15/)
  await expect(panel.locator('[data-piece-id="two"]')).toHaveAttribute('aria-label', /column 28, row 15/)
})


test.describe('touch board navigation', () => {
  test.use({ contextOptions: { hasTouch: true, reducedMotion: 'reduce' } })
  test('pan mode captures touch without creating a selection', async ({ page }) => {
    const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
    const viewport = panel.getByRole('region', { name: /Board workspace/ })
    await panel.getByRole('button', { name: 'Pan board', exact: true }).tap()
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = await viewport.boundingBox()
    if (!box) throw new Error('Missing viewport')
    const touch = new Touch(page)
    await touch.down(1, { x: box.x + 300, y: box.y + 150 })
    await touch.move(1, { x: box.x + 100, y: box.y + 75 })
    await touch.up(1)
    await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
    await expect(panel.locator('[data-piece-id]')).toHaveCount(0)
    await panel.getByRole('button', { name: 'Reset view', exact: true }).tap()
    await expect.poll(() => viewport.evaluate(el => [el.scrollLeft, el.scrollTop])).toEqual([0, 0])
  })
})


test('zooming cancels an unfinished drag without moving the rod', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  await panel.getByRole('button', { name: 'Choose five rod', exact: true }).click()
  const rod = panel.locator('[data-piece-id]')
  const box = await rod.locator('[data-rod-surface]').boundingBox()
  if (!box) throw new Error('Missing rod')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60, { steps: 8 })
  await panel.getByLabel('Zoom', { exact: true }).selectOption('0.5')
  await page.mouse.up()
  await expect(rod).toHaveAttribute('aria-label', /column 0, row 0/)
  await expect.poll(() => rod.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBe(0)
})

test('shrinking also validates saved goals against the new capacity', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  const level = document([])
  Object.assign(level.steps[0]!, { goal: { type: 'all', conditions: [{ type: 'filled-rectangle', regionId: 'array', x: 80, y: 80, columns: 10, rows: 10 }] } })
  await panel.locator('input[type=file]').setInputFiles({ name: 'goal.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(level)) })
  await panel.getByRole('group', { name: 'Replace level confirmation' }).getByRole('button', { name: 'Replace', exact: true }).click()
  await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Columns', { exact: true }).fill('24')
  await panel.getByRole('form', { name: 'Board dimensions' }).getByLabel('Rows', { exact: true }).fill('12')
  await panel.getByRole('button', { name: 'Resize board', exact: true }).click()
  await expect(panel).toContainText('Cannot resize:')
  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
})

test('importing a level adopts its saved board size', async ({ page }) => {
  const panel = page.getByRole('tabpanel', { name: arrayName, exact: true })
  const size = panel.getByRole('form', { name: 'Board dimensions' })
  await size.getByLabel('Columns').fill('30')
  await size.getByLabel('Rows').fill('20')
  await size.getByRole('button', { name: 'Resize board', exact: true }).click()
  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '30')

  await panel.locator('input[type=file]').setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document([
    { id: 'far', anchor: { x: 90, y: 95 }, parts: [part(5)] },
  ]))) })
  const confirmation = panel.getByRole('group', { name: 'Replace level confirmation' })
  await expect(confirmation).toContainText("The board will change to this level's size.")
  await confirmation.getByRole('button', { name: 'Replace', exact: true }).click()

  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-columns', '100')
  await expect(panel.locator('[data-grid-world]')).toHaveAttribute('data-grid-rows', '100')
  await expect(size.getByLabel('Columns')).toHaveValue('100')
  await expect(panel.locator('[data-piece-id="far"]')).toHaveAttribute('aria-label', /column 90, row 95/)
})
