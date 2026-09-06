import { test, expect } from '@playwright/test'

test('domain ratios drive all rod poses and stay matched to grid cells', async ({ page, request }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const response = await request.get('/api/rods')
  expect(response.ok()).toBe(true)
  const catalog = await response.json()
  expect(catalog).toHaveLength(10)
  await page.goto('/dev/grid-2d')
  await expect(page.locator('[data-role=viewport]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('[data-role=rod]')).toHaveCount(10)
  const slider = page.getByRole('slider', { name: 'Cell size' })
  for (const size of [20, 40]) {
    await slider.fill(String(size))
    await expect.poll(() => page.locator('[data-grid-world]').evaluate(el => getComputedStyle(el).getPropertyValue('--cell-size'))).toBe(`${size}px`)
    for (const definition of catalog) {
      const rod = page.locator(`[data-role=rod][data-length="${definition.length}"]`)
      await page.getByRole('button', { name: `Select ${definition.color.replace(/([A-Z])/g, ' $1').toLowerCase()} rod`, exact: true }).click()
      // Towers always fit at the current rod origin; horizontal restores the initial footprint.
      for (const orientation of ['tower', 'horizontal']) {
        await page.getByRole('button', { name: orientation === 'tower' ? 'Tower' : 'Horizontal', exact: true }).click()
        const dimensions = definition.poses.find((pose: { orientation: string }) => pose.orientation === orientation).dimensions
        await expect(rod).toHaveAttribute('data-orientation', orientation)
        await expect.poll(() => rod.evaluate(el => ['--w', '--d', '--h'].map(key => (el as HTMLElement).style.getPropertyValue(key))))
          .toEqual([`${dimensions.width * size}px`, `${dimensions.depth * size}px`, `${dimensions.height * size}px`])
      }
    }
  }
  await page.getByRole('button', { name: 'Select red rod', exact: true }).click()
  await page.getByRole('button', { name: 'Vertical', exact: true }).click()
  await expect(page.locator('[data-role=rod][data-length="2"]')).toHaveCSS('width', '40px')
  await expect(page.locator('[data-role=rod][data-length="2"]')).toHaveCSS('height', '80px')
  await slider.fill('28')
  await page.locator('[data-role=viewport]').screenshot({ path: testInfo.outputPath('domain-ratios.png') })
  expect(errors).toEqual([])
})

test('domain-backed rods still snap and reject overlapping drops', async ({ page }) => {
  await page.goto('/dev/grid-2d')
  await expect(page.locator('[data-role=viewport]')).toHaveAttribute('data-ready', 'true')
  const red = page.locator('[data-role=rod][data-length="2"]')
  const axes = await page.locator('[data-grid-world]').evaluate(world => {
    const rect = (name: string) => world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
    const o = rect('origin'), y = rect('y')
    return { x: y.x - o.x, y: y.y - o.y }
  })
  async function moveRows(rows: number) {
    const rect = await red.locator('.top').boundingBox()
    if (!rect) throw new Error('Rod face missing')
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + axes.x * rows, y + axes.y * rows, { steps: 10 })
    await page.mouse.up()
  }
  await moveRows(2)
  await expect(red).toHaveAttribute('data-y', '2')
  await moveRows(2)
  await expect(red).toHaveAttribute('data-y', '2')
  await expect(page.getByRole('status')).toContainText('occupied or outside')
})
