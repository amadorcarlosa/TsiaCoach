import type { Locator } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

async function snapshot(p: Playground, panel: Locator) {
  return Promise.all((await panel.locator('[data-piece-id]').all()).map(async train => ({
    id: await train.getAttribute('data-piece-id'),
    geometry: await p.geometry(train),
    preview: await train.evaluate(el => {
      const translation = getComputedStyle(el).translate
      return translation === 'none' ? [0, 0] : translation.split(/\s+/).map(Number.parseFloat)
    }),
    parts: await Promise.all((await train.locator('.train-part').all()).map(async part => ({
      value: await part.getAttribute('data-part-value'),
      geometry: await p.geometry(part),
    }))),
  })))
}

async function arrangement(p: Playground, assemble = true) {
  const panel = await p.show('MathTabla')
  const destination = panel.getByRole('group', { name: 'Rod destination', exact: true })
  const rods: Locator[] = []
  for (const [label, value] of [
    ['Horizontal D', 'four'], ['Horizontal N', 'three'],
    ['Vertical D', 'three'], ['Vertical N', 'two'],
    ['Central array', 'three'], ['Central array', 'three'],
  ]) {
    await destination.getByRole('button', { name: label, exact: true }).click()
    rods.push(await p.add('MathTabla', value!))
  }
  const second = rods[5]!
  await expect.poll(() => p.geometry(second)).toMatchObject({ x: 5, y: 2, width: 3, depth: 1 })
  // The author physically moves the second rod; no regroup/factor command is used.
  if (assemble) {
    await p.drag(second, -3, 1)
    await expect.poll(() => p.geometry(second)).toMatchObject({ x: 2, y: 3, width: 3, depth: 1, offset: 0 })
  }
  return { panel, destination, rods }
}

test('MathTabla builds the reference tracks and manual 3 × 2 arrangement in one coordinate system', async ({ playground: p }) => {
  const { panel, rods } = await arrangement(p)
  const expected = [
    { x: 2, y: 0, width: 4, depth: 1 }, { x: 2, y: 1, width: 3, depth: 1 },
    { x: 0, y: 2, width: 1, depth: 3 }, { x: 1, y: 2, width: 1, depth: 2 },
    { x: 2, y: 2, width: 3, depth: 1 }, { x: 2, y: 3, width: 3, depth: 1 },
  ]
  for (const [i, rod] of rods.entries()) await expect.poll(() => p.geometry(rod)).toMatchObject(expected[i]!)
  const regions = await panel.locator('[data-math-region]').evaluateAll(elements => elements.map(el => {
    const node = el as HTMLElement
    const cell = parseFloat(getComputedStyle(node).getPropertyValue('--cell-size'))
    return { id: node.dataset.mathRegion, x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
      width: parseFloat(node.style.width) / cell, depth: parseFloat(node.style.height) / cell }
  }))
  expect(regions).toEqual([
    { id: 'horizontal-d', x: 2, y: 0, width: 24, depth: 1 },
    { id: 'horizontal-n', x: 2, y: 1, width: 24, depth: 1 },
    { id: 'vertical-d', x: 0, y: 2, width: 1, depth: 12 },
    { id: 'vertical-n', x: 1, y: 2, width: 1, depth: 12 },
    { id: 'array', x: 2, y: 2, width: 24, depth: 12 },
  ])
  await expect(panel.getByRole('button', { name: 'tower', exact: true })).toHaveCount(0)
  for (const [index, rejected] of [[0, 'Vertical'], [2, 'Horizontal']] as const) {
    const menu = await p.menu(rods[index]!)
    await expect(menu.getByRole('menuitemcheckbox', { name: new RegExp(`^${rejected}`) })).toBeDisabled()
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Tower', exact: true })).toHaveCount(0)
    await p.page.keyboard.press('Escape')
  }
  await p.drag(rods[0]!, -2, 0)
  await expect.poll(() => p.geometry(rods[0]!)).toMatchObject(expected[0]!)
  await p.page.screenshot({ path: 'output/playwright/mathtabla-arrangement.png', fullPage: true })
})

test('MathTabla empty board clicks choose a region while corner clicks preserve the destination', async ({ playground: p }) => {
  const panel = await p.show('MathTabla')
  const destination = panel.getByRole('group', { name: 'Rod destination', exact: true })
  for (const [point, label] of [
    [{ x: 0.5, y: 5.5 }, 'Vertical D'], [{ x: 1.5, y: 5.5 }, 'Vertical N'],
    [{ x: 8.5, y: 0.5 }, 'Horizontal D'], [{ x: 8.5, y: 1.5 }, 'Horizontal N'],
    [{ x: 8.5, y: 5.5 }, 'Central array'],
  ] as const) {
    const client = await p.boardClient('MathTabla', point)
    await p.page.mouse.click(client.x, client.y)
    await expect(destination.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
  }
  const corner = await p.boardClient('MathTabla', { x: 0.5, y: 0.5 })
  await p.page.mouse.click(corner.x, corner.y)
  await expect(destination.getByRole('button', { name: 'Central array', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const rod = await p.add('MathTabla', 'three')
  await expect.poll(() => p.geometry(rod)).toMatchObject({ x: 2, y: 2 })
})

for (const cancellation of ['tab change', 'step restoration'] as const) {
test(`MathTabla authoring restores references and interior rods and cancels a held group drag on ${cancellation}`, async ({ playground: p, page }) => {
  const { panel, rods } = await arrangement(p)
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  const step = (n: number) => controls.getByRole('button', { name: `Step ${n}`, exact: true })
  const original = await snapshot(p, panel)
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await rods[0]!.click()
  await rods[4]!.click({ modifiers: ['Shift'] })
  await p.drag(rods[0]!, 5, 0)
  await expect.poll(() => p.geometry(rods[0]!)).toMatchObject({ x: 7, y: 0 })
  await expect.poll(() => p.geometry(rods[4]!)).toMatchObject({ x: 7, y: 2 })
  const moved = await snapshot(p, panel)
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await step(1).click()
  await expect.poll(() => snapshot(p, panel)).toEqual(original)
  await rods[0]!.click()
  await rods[4]!.click({ modifiers: ['Shift'] })
  await rods[0]!.scrollIntoViewIfNeeded()
  const face = await rods[0]!.locator('.face.top').boundingBox()
  if (!face) throw new Error('Missing horizontal reference rod')
  const start = await p.boardClient('MathTabla', { x: 0, y: 0 })
  const end = await p.boardClient('MathTabla', { x: 3, y: 0 })
  await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
  await page.mouse.down()
  try {
    await page.mouse.move(face.x + face.width / 2 + end.x - start.x, face.y + face.height / 2 + end.y - start.y, { steps: 8 })
    await expect.poll(() => rods[4]!.evaluate(el => {
      const translation = getComputedStyle(el).translate
      return translation === 'none' ? 0 : Math.abs(parseFloat(translation))
    })).toBeGreaterThan(0)
    if (cancellation === 'tab change') {
      await page.getByRole('tab', { name: 'Bar Rod Playground', exact: true }).focus()
    } else {
      await step(2).focus()
    }
    await page.keyboard.press('Enter')
  } finally {
    await page.mouse.up()
  }
  if (cancellation === 'tab change') {
    await p.show('MathTabla')
    await expect.poll(() => snapshot(p, panel)).toEqual(original)
    await expect(step(1)).toHaveAttribute('aria-pressed', 'true')
  } else {
    await expect.poll(() => snapshot(p, panel)).toEqual(moved)
    await expect(step(2)).toHaveAttribute('aria-pressed', 'true')
  }
  await step(2).click()
  await expect.poll(() => snapshot(p, panel)).toEqual(moved)
  await step(1).click()
  await expect.poll(() => snapshot(p, panel)).toEqual(original)
})
}

test('MathTabla guide counts actual central footprints independently of references and restores with the board', async ({ playground: p, page }) => {
  const { panel, rods } = await arrangement(p, false)
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const toggle = readouts.getByRole('checkbox', { name: 'Show denominator guide', exact: true })
  const guide = panel.locator('[data-math-guide]')
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  await expect(readouts).toContainText('Horizontal reference: N 3, D 4')
  await expect(readouts).toContainText('Vertical reference: N 2, D 3')
  await expect(toggle).not.toBeChecked()
  await expect(guide).toHaveCount(0)
  const before = await snapshot(p, panel)
  await toggle.check()
  expect(await snapshot(p, panel)).toEqual(before)
  await expect(readouts).toContainText('Denominator guide: 4 × 3 = 12 cells')
  await expect(readouts).toContainText('Occupied inside guide: 4 of 12 cells')
  expect(await guide.evaluate(el => {
    const node = el as HTMLElement
    const cell = parseFloat(getComputedStyle(node).getPropertyValue('--cell-size'))
    return { x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
      width: parseFloat(node.style.width) / cell, depth: parseFloat(node.style.height) / cell }
  })).toEqual({ x: 2, y: 2, width: 4, depth: 3 })
  await p.drag(rods[5]!, -3, 1)
  await expect(readouts).toContainText('Occupied inside guide: 6 of 12 cells')
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await toggle.uncheck()
  await toggle.check()
  await expect(controls.getByRole('button', { name: 'Update step', exact: true })).toBeDisabled()
  await p.drag(rods[5]!, 6, 0)
  await expect(readouts).toContainText('Occupied inside guide: 3 of 12 cells')
  await expect(readouts).toContainText('Horizontal reference: N 3, D 4')
  await expect(readouts).toContainText('Vertical reference: N 2, D 3')
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await controls.getByRole('button', { name: 'Step 1', exact: true }).click()
  await expect(readouts).toContainText('Occupied inside guide: 6 of 12 cells')
  await page.screenshot({ path: 'output/playwright/mathtabla-guide.png', fullPage: true })
  await rods[0]!.click()
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await expect(readouts).toContainText('Horizontal reference: N 3, D 0')
  await expect(toggle).toBeDisabled()
  await expect(guide).toHaveCount(0)
})

for (const viewport of [{ width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1440, height: 900 }]) {
  test(`MathTabla geometry and destination controls stay stable at ${viewport.width} × ${viewport.height}`, async ({ playground: p, page }) => {
    const { panel } = await arrangement(p)
    await page.setViewportSize(viewport)
    const world = panel.locator('[data-grid-world]')
    await expect(world).toHaveAttribute('data-grid-columns', '26')
    await expect(world).toHaveAttribute('data-grid-rows', '14')
    const destinations = panel.getByRole('group', { name: 'Rod destination', exact: true })
    await expect(destinations.getByRole('button')).toHaveText(['Horizontal D', 'Horizontal N', 'Vertical D', 'Vertical N', 'Central array'])
    expect(await destinations.evaluate(el => {
      const rect = el.getBoundingClientRect()
      return Array.from(el.querySelectorAll('button')).every(button => {
        const child = button.getBoundingClientRect()
        return child.left >= rect.left && child.right <= rect.right + 1
      }) && !el.closest('.math-viewport')
    })).toBe(true)
    if (viewport.width < viewport.height) {
      await expect(panel.getByText('Portrait preview: two reference columns and the first 12 central-grid columns. Rotate to landscape to edit.', { exact: true })).toBeVisible()
      for (const button of await destinations.getByRole('button').all()) await expect(button).toBeDisabled()
    }
    await page.screenshot({ path: `output/playwright/mathtabla-${viewport.width}.png`, fullPage: true })
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(panel.locator('[data-piece-id]')).toHaveCount(6)
  })
}
