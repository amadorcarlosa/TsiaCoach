import { test, expect, type Page } from '@playwright/test'

test('starts at rod size, preserves zoom on resize, and resets from Fit', async ({ page }) => {
  const board = await open(page, false)
  const cell = () => board.locator('[data-grid-world]').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--cell-size')))
  await expect.poll(cell).toBe(36)
  await page.setViewportSize({ width: 1200, height: 800 })
  await expect.poll(cell).toBe(36)
  await board.getByRole('button', { name: 'Fit board', exact: true }).click()
  await expect.poll(cell).toBeLessThan(10)
  await board.getByRole('button', { name: 'Rod size', exact: true }).click()
  await expect.poll(cell).toBe(36)
})

test('large towers preserve the camera and fit their exposed tops', async ({ page }) => {
  const board = await open(page, false)
  const origin = board.locator('[data-grid-axis="origin"]')
  const before = (await origin.boundingBox())!
  await board.getByRole('button', { name: 'Add 100,000', exact: true }).click()
  const block = board.locator('[data-denomination="hundredThousands"]')
  await expect(block).toHaveAttribute('data-pose', 'tower')
  await expect.poll(async () => Math.abs((await origin.boundingBox())!.y - before.y)).toBeLessThan(2)
  await expect(board.getByRole('button', { name: 'Lay flat', exact: true })).toBeDisabled()
  await board.getByRole('button', { name: 'Fit board', exact: true }).click()
  const viewport = (await board.getByLabel('Base-ten board viewport', { exact: true }).boundingBox())!
  const top = (await block.locator('.face.top').boundingBox())!
  expect(top.y).toBeGreaterThanOrEqual(viewport.y)
  expect(top.y + top.height).toBeLessThan(viewport.y + viewport.height)
  expect(top.x + top.width).toBeLessThan(viewport.x + viewport.width)
  await board.getByRole('button', { name: 'Exchange down', exact: true }).click()
  await expect(board.locator('[data-denomination="tenThousands"][data-pose="tower"]')).toHaveCount(10)
  await board.getByRole('button', { name: 'Exchange up', exact: true }).click()
  await expect(board.getByTestId('base-ten-summary')).toHaveText('1 objects · Total value 100,000')
})

test('hundred stands upright and drags from its elevated top face', async ({ page }) => {
  const board = await open(page, false)
  await board.getByRole('button', { name: 'Add 100', exact: true }).click()
  await board.getByRole('button', { name: 'Stand upright', exact: true }).click()
  const block = board.locator('[data-denomination="hundreds"]')
  await expect(block).toHaveAttribute('data-pose', 'tower')
  await expect(block.locator('.front .value-label')).toHaveText('100')
  await expect(block.locator('.top .value-label')).toHaveCount(0)
  const broadFace = (await block.locator('.front').boundingBox())!
  expect(broadFace.height).toBeGreaterThan(300)
  // Check rendered corners, not bounding boxes: a tapered side can have the
  // correct bounds while its top and bottom depth edges disagree.
  const corners = await block.evaluate(el => {
    const sample = (selector: string) => {
      const face = el.querySelector<HTMLElement>(selector)!
      return [[0, 0], [face.offsetWidth, 0], [face.offsetWidth, face.offsetHeight], [0, face.offsetHeight]].map(([x, y]) => {
        const probe = document.createElement('i')
        probe.style.cssText = `position:absolute;left:${x! - face.clientLeft}px;top:${y! - face.clientTop}px;width:0;height:0;`
        face.append(probe)
        const rect = probe.getBoundingClientRect()
        probe.remove()
        return { x: rect.x, y: rect.y }
      })
    }
    return { front: sample('.front'), right: sample('.right'), top: sample('.top') }
  })
  const [ftl, ftr, fbr, fbl] = corners.front
  const [rbt, rft, rfb, rbb] = corners.right
  expect(Math.abs(ftl!.x - fbl!.x)).toBeLessThan(1)
  expect(Math.abs(ftr!.x - fbr!.x)).toBeLessThan(1)
  expect(Math.abs(broadFace.width - broadFace.height)).toBeLessThan(1)
  expect(Math.abs((rbt!.x - rft!.x) - (rbb!.x - rfb!.x))).toBeLessThan(1)
  expect(Math.abs((rbt!.y - rft!.y) - (rbb!.y - rfb!.y))).toBeLessThan(1)
  for (const [a, b] of [[ftr!, rft!], [fbr!, rfb!], [corners.top[1]!, rbt!], [corners.top[2]!, rft!]]) {
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeLessThan(1)
  }
  const viewBounds = (await board.getByLabel('Base-ten board viewport', { exact: true }).boundingBox())!
  await expect.poll(async () => (await block.locator('.face.top').boundingBox())!.y).toBeGreaterThan(viewBounds.y)
  await board.getByLabel('Base-ten board viewport', { exact: true }).evaluate(el => { el.scrollTop = 0; el.scrollLeft = 0 })
  const face = block.locator('.face.top')
  await face.hover()
  const box = (await face.boundingBox())!
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 36, start.y + 36 * Math.cos(Math.PI / 12), { steps: 12 })
  await page.mouse.up()
  await expect(block).toHaveAttribute('data-x', '1')
  await expect(block).toHaveAttribute('data-y', '1')
  await board.getByRole('button', { name: 'Lay flat', exact: true }).click()
  await expect(block).toHaveAttribute('data-pose', 'standard')
})

async function open(page: Page, fit = true) {
  await page.goto('/dev/playground')
  await expect(page.getByRole('tabpanel', { name: 'Bar Rod Playground', exact: true }).locator('[data-ready="true"]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: 'Base ten', exact: true }).click()
  const board = page.getByRole('region', { name: 'Array base-ten playground' })
  await expect(board.locator('[data-ready="true"]')).toBeVisible()
  if (fit) await board.getByRole('button', { name: 'Fit board', exact: true }).click()
  return board
}
test('all five denominations, keyboard movement, menus and retained tab state', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const board = await open(page)
  for (const value of ['1', '10', '100', '1,000', '10,000']) await board.getByRole('button', { name: `Add ${value}`, exact: true }).click()
  await expect(board.getByTestId('base-ten-summary')).toHaveText('5 objects · Total value 11,111')
  const large = board.locator('[data-denomination="tenThousands"]')
  await expect(large).toBeVisible()
  await large.focus()
  await large.press('ArrowDown')
  await expect(large).toHaveAttribute('data-y', '1')
  await large.press('Shift+F10')
  await expect(page.getByRole('menu', { name: 'Base-ten actions' })).toBeVisible()
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await expect(board.getByTestId('base-ten-summary')).toHaveText('4 objects · Total value 1,111')
  await page.getByRole('tab', { name: 'Array Rod Playground', exact: true }).click()
  await page.getByRole('tab', { name: 'Base ten', exact: true }).click()
  await expect(board.locator('[data-base-ten-id]')).toHaveCount(4)
  expect(errors).toEqual([])
})
test('ten-thousand exchange round trip and marquee selects ten thousands', async ({ page }) => {
  const board = await open(page)
  await board.getByRole('button', { name: 'Add 10,000', exact: true }).click()
  await board.getByRole('button', { name: 'Exchange down', exact: true }).click()
  await expect(board.locator('[data-denomination="thousands"]')).toHaveCount(10)
  await expect(board.getByTestId('base-ten-summary')).toHaveText('10 objects · Total value 10,000')
  await board.getByRole('button', { name: 'Exchange up', exact: true }).click()
  await expect(board.locator('[data-denomination="tenThousands"]')).toHaveCount(1)
  await board.getByRole('button', { name: 'Exchange down', exact: true }).click()
  const world = board.locator('[data-grid-world]')
  const box = (await world.boundingBox())!
  // Start below the blocks, then enclose all footprints back to the origin.
  await page.mouse.move(box.x + box.width * .99, box.y + box.height * .3)
  await page.mouse.down()
  await page.mouse.move(box.x + .5, box.y + .5, { steps: 10 })
  await page.mouse.up()
  await expect(board.locator('[data-base-ten-id][aria-pressed="true"]')).toHaveCount(10)
  await expect(board.getByRole('button', { name: 'Exchange up', exact: true })).toBeEnabled()
})
test('zoom, pan and grid-aware dragging', async ({ page }) => {
  const board = await open(page)
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  await board.getByRole('button', { name: 'Add 100', exact: true }).click()
  for (let i = 0; i < 5; i++) await board.getByRole('button', { name: 'Zoom in', exact: true }).click()
  const viewport = board.getByLabel('Base-ten board viewport', { exact: true })
  await viewport.evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0 })
  const block = board.locator('[data-denomination="hundreds"]')
  const axes = await board.locator('[data-grid-world]').evaluate(el => {
    const point = (name: string) => el.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
    const o = point('origin'), x = point('x'), y = point('y')
    return { x: x.x - o.x, y: y.y - o.y }
  })
  await block.hover()
  const box = (await block.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + axes.x * 12, box.y + box.height / 2 + axes.y * 12, { steps: 12 })
  await page.mouse.up()
  await expect(block).toHaveAttribute('data-x', '12')
  await expect(block).toHaveAttribute('data-y', '12')
  await board.getByRole('button', { name: 'Select mode', exact: true }).click()
  const v = (await viewport.boundingBox())!
  await page.mouse.move(v.x + 300, v.y + 300)
  await page.mouse.down()
  await page.mouse.move(v.x + 200, v.y + 200, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(50)
  await board.getByRole('button', { name: 'Fit board', exact: true }).click()
  await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBe(0)
})
test('portrait is read-only while view controls remain available', async ({ page }) => {
  const board = await open(page)
  await board.getByRole('button', { name: 'Add 1,000', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(board.getByText('Portrait preview. Rotate to landscape to edit.')).toBeVisible()
  await expect(board.getByRole('button', { name: 'Add 1', exact: true })).toBeDisabled()
  await expect(board.getByRole('button', { name: 'Exchange down', exact: true })).toBeDisabled()
  await expect(board.getByRole('button', { name: 'Zoom in', exact: true })).toBeEnabled()
  await page.setViewportSize({ width: 1000, height: 600 })
  await expect(board.getByRole('button', { name: 'Exchange down', exact: true })).toBeEnabled()
})

test('rotation, clone, modifier selection and group keyboard movement', async ({ page }) => {
  const board = await open(page)
  await board.getByRole('button', { name: 'Add 10', exact: true }).click()
  await board.getByRole('button', { name: 'Rotate', exact: true }).click()
  const original = board.locator('[data-base-ten-id]').first()
  await expect(original).toHaveAttribute('data-rotated', 'true')
  await board.getByRole('button', { name: 'Clone', exact: true }).click()
  await expect(board.locator('[data-base-ten-id]')).toHaveCount(2)
  await original.click({ modifiers: ['Shift'] })
  await expect(board.locator('[aria-pressed="true"][data-base-ten-id]')).toHaveCount(2)
  await original.press('ArrowDown')
  for (const block of await board.locator('[data-base-ten-id]').all()) await expect(block).toHaveAttribute('data-y', '1')
  await board.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(board.getByTestId('base-ten-summary')).toHaveText('0 objects · Total value 0')
})

for (const boundary of ['zoom', 'tab'] as const) {
  test(`unfinished dragging is cancelled by ${boundary}`, async ({ page }) => {
    const board = await open(page)
    await board.getByRole('button', { name: 'Add 100', exact: true }).click()
    const block = board.locator('[data-base-ten-id]')
    const box = (await block.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 70, { steps: 10 })
    if (boundary === 'zoom') {
      await board.getByRole('button', { name: 'Zoom in', exact: true }).focus()
      await page.keyboard.press('Enter')
    } else {
      await page.getByRole('tab', { name: 'Array Rod Playground', exact: true }).focus()
      await page.keyboard.press('Enter')
    }
    await page.mouse.up()
    if (boundary === 'tab') await page.getByRole('tab', { name: 'Base ten', exact: true }).click()
    await expect(block).toHaveAttribute('data-x', '0')
    await expect(block).toHaveAttribute('data-y', '0')
    await expect.poll(() => block.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBe(0)
  })
}

test('touch long press opens actions without moving the block', async ({ page }) => {
  const board = await open(page)
  await board.getByRole('button', { name: 'Add 1,000', exact: true }).click()
  const block = board.locator('[data-base-ten-id]')
  const bounds = (await block.boundingBox())!
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] })
  await expect(page.getByRole('menu', { name: 'Base-ten actions' })).toBeVisible()
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.keyboard.press('Escape')
  await expect(block).toBeFocused()
  await expect(block).toHaveAttribute('data-x', '0')
})
