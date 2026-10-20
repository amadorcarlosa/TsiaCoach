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
  const face = await rods[0]!.locator('[data-rod-surface]').boundingBox()
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

const areaGeometry = (el: Element) => {
  const node = el as HTMLElement
  const cell = parseFloat(getComputedStyle(node).getPropertyValue('--cell-size'))
  return { x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
    width: parseFloat(node.style.width) / cell, depth: parseFloat(node.style.height) / cell }
}

test('MathTabla whole area appears with the D references alone and stays flat under the rods', async ({ playground: p }) => {
  const panel = await p.show('MathTabla')
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const destination = panel.getByRole('group', { name: 'Rod destination', exact: true })
  const area = panel.locator('[data-math-guide]')
  await expect(readouts).toContainText('Add rods to the horizontal and vertical D tracks to define the whole area.')
  await expect(area).toHaveCount(0)

  await destination.getByRole('button', { name: 'Horizontal D', exact: true }).click()
  await p.add('MathTabla', 'three')
  await expect(readouts).toContainText('Add a rod to the vertical D track to define the whole area.')
  await expect(area).toHaveCount(0)

  await destination.getByRole('button', { name: 'Vertical D', exact: true }).click()
  await p.add('MathTabla', 'five')
  // The area is derived from the references alone: no central rods were created.
  await expect(readouts).toContainText('Whole area: 3 × 5 = 15 square units')
  await expect(readouts).toContainText('Covered: 0 of 15 square units')
  await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
  expect(await area.evaluate(areaGeometry)).toEqual({ x: 2, y: 2, width: 3, depth: 5 })
  // A surface, not a rod: no raised faces inside it, and it never blocks pointers.
  await expect(area.locator('.face')).toHaveCount(0)
  expect(await area.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')

  await destination.getByRole('button', { name: 'Central array', exact: true }).click()
  const central = await p.add('MathTabla', 'three')
  await expect(readouts).toContainText('Covered: 3 of 15 square units')
  expect(await area.evaluate(areaGeometry)).toEqual({ x: 2, y: 2, width: 3, depth: 5 })
  // Every rod is a later sibling than the area, so rods paint above it.
  expect(await panel.locator('[data-grid-world]').first().evaluate(world => {
    const children = [...world.children]
    const surface = children.findIndex(child => child.matches('[data-math-guide]'))
    const rods = children.filter(child => child.matches('[data-piece-id]')).map(rod => children.indexOf(rod))
    return { surface: surface >= 0, rods: rods.length, above: rods.every(index => index > surface) }
  })).toEqual({ surface: true, rods: 3, above: true })
  await p.drag(central, 0, 1)
  await expect.poll(() => p.geometry(central)).toMatchObject({ x: 2, y: 3, width: 3, depth: 1 })
  const menu = await p.menu(central)
  await expect(menu.getByRole('menuitem', { name: 'Clone', exact: true })).toBeVisible()
  await p.page.keyboard.press('Escape')
})

test('MathTabla whole area counts actual central footprints independently of references and restores with the board', async ({ playground: p, page }) => {
  const { panel, rods } = await arrangement(p, false)
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const area = panel.locator('[data-math-guide]')
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  await expect(readouts).toContainText('Horizontal reference: N 3, D 4')
  await expect(readouts).toContainText('Vertical reference: N 2, D 3')
  await expect(readouts).toContainText('Whole area: 4 × 3 = 12 square units')
  await expect(readouts).toContainText('Covered: 4 of 12 square units')
  expect(await area.evaluate(areaGeometry)).toEqual({ x: 2, y: 2, width: 4, depth: 3 })
  await p.drag(rods[5]!, -3, 1)
  await expect(readouts).toContainText('Covered: 6 of 12 square units')
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await expect(controls.getByRole('button', { name: 'Update step', exact: true })).toBeDisabled()
  // Partly outside the whole: only the intersection is counted.
  await p.drag(rods[5]!, 6, 0)
  await expect(readouts).toContainText('Covered: 3 of 12 square units')
  await expect(readouts).toContainText('Horizontal reference: N 3, D 4')
  await expect(readouts).toContainText('Vertical reference: N 2, D 3')
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await controls.getByRole('button', { name: 'Step 1', exact: true }).click()
  await expect(readouts).toContainText('Covered: 6 of 12 square units')
  // The restored step re-derives the area from the restored references.
  expect(await area.evaluate(areaGeometry)).toEqual({ x: 2, y: 2, width: 4, depth: 3 })
  await page.screenshot({ path: 'output/playwright/mathtabla-whole-area.png', fullPage: true })
  const before = await snapshot(p, panel)
  await rods[0]!.click()
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await expect(readouts).toContainText('Horizontal reference: N 3, D 0')
  await expect(readouts).toContainText('Add a rod to the horizontal D track to define the whole area.')
  await expect(area).toHaveCount(0)
  // Removing a reference removes the area without moving the central rods.
  expect((await snapshot(p, panel)).map(piece => piece.geometry))
    .toEqual(before.slice(1).map(piece => piece.geometry))
})

const bandGeometry = (elements: Element[]) => elements.map(el => {
  const node = el as HTMLElement
  const cell = parseFloat(getComputedStyle(node).getPropertyValue('--cell-size'))
  return { grouping: node.dataset.mathGrouping, x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
    width: parseFloat(node.style.width) / cell, depth: parseFloat(node.style.height) / cell }
})

const partLayout = (train: Locator) => train.locator('.train-part').evaluateAll(parts => parts.map(el => {
  const node = el as HTMLElement
  const cell = parseFloat(getComputedStyle(node.closest('[data-grid-world]')!).getPropertyValue('--cell-size'))
  const rod = getComputedStyle(node.querySelector('.rod')!)
  return { value: Number(node.dataset.partValue),
    x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
    width: parseFloat(rod.getPropertyValue('--w')) / cell, depth: parseFloat(rod.getPropertyValue('--d')) / cell }
}))

async function whole3by5(p: Playground) {
  const panel = await p.show('MathTabla')
  const destination = panel.getByRole('group', { name: 'Rod destination', exact: true })
  await destination.getByRole('button', { name: 'Horizontal D', exact: true }).click()
  await p.add('MathTabla', 'three')
  await destination.getByRole('button', { name: 'Vertical D', exact: true }).click()
  await p.add('MathTabla', 'five')
  return { panel, destination }
}

test('MathTabla groups the flat whole without creating any material', async ({ playground: p, page }) => {
  const panel = await p.show('MathTabla')
  const grouping = panel.getByRole('group', { name: 'Group the whole', exact: true })
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const bands = panel.locator('[data-math-group-band]')

  // No whole yet: nothing to group, and the control says why.
  await expect(grouping.getByRole('button')).toHaveText(['No grouping'])
  await expect(grouping.getByRole('button', { name: 'No grouping', exact: true })).toBeDisabled()
  await expect(panel.getByText('Define the whole with both D references before grouping it.', { exact: true })).toBeVisible()

  const { destination } = await whole3by5(p)
  await expect(readouts).toContainText('Whole area: 3 × 5 = 15 square units')
  await expect(readouts).toContainText('Covered: 0 of 15 square units')
  await expect(grouping.getByRole('button')).toHaveText([
    'No grouping', '3 groups of 5 (vertical columns)', '5 groups of 3 (horizontal rows)',
  ])
  await expect(bands).toHaveCount(0)
  await expect(panel.getByText('The whole is not grouped.', { exact: true })).toBeVisible()

  // Grouping the whole with an empty numerator creates no rods and covers nothing.
  await grouping.getByRole('button', { name: '3 groups of 5 (vertical columns)', exact: true }).click()
  await expect(panel.getByText('3 groups × 5 square units = 15 square units', { exact: true })).toBeVisible()
  expect(await bands.evaluateAll(bandGeometry)).toEqual([
    { grouping: 'columns', x: 2, y: 2, width: 1, depth: 5 },
    { grouping: 'columns', x: 3, y: 2, width: 1, depth: 5 },
    { grouping: 'columns', x: 4, y: 2, width: 1, depth: 5 },
  ])
  await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
  await expect(readouts).toContainText('Covered: 0 of 15 square units')
  await expect(bands.locator('.face')).toHaveCount(0)
  expect(await bands.first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')

  // The other grouping of the same area: same boundary, same total, same coverage.
  await grouping.getByRole('button', { name: '5 groups of 3 (horizontal rows)', exact: true }).click()
  await expect(panel.getByText('5 groups × 3 square units = 15 square units', { exact: true })).toBeVisible()
  expect(await bands.evaluateAll(bandGeometry)).toEqual([2, 3, 4, 5, 6].map(y =>
    ({ grouping: 'rows', x: 2, y, width: 3, depth: 1 })))
  expect(await panel.locator('[data-math-guide]').evaluate(areaGeometry)).toEqual({ x: 2, y: 2, width: 3, depth: 5 })
  await expect(panel.locator('[data-piece-id]')).toHaveCount(2)
  await expect(readouts).toContainText('Whole area: 3 × 5 = 15 square units')
  await expect(readouts).toContainText('Covered: 0 of 15 square units')

  // Raised rods still paint above the flat marks, and still move and open menus.
  await destination.getByRole('button', { name: 'Central array', exact: true }).click()
  const central = await p.add('MathTabla', 'three')
  await expect(readouts).toContainText('Covered: 3 of 15 square units')
  expect(await panel.locator('[data-grid-world]').first().evaluate(world => {
    const children = [...world.children]
    const surface = children.findIndex(child => child.matches('[data-math-guide]'))
    const marks = children.flatMap((child, index) => child.matches('[data-math-group-band]') ? [index] : [])
    const rods = children.flatMap((child, index) => child.matches('[data-piece-id]') ? [index] : [])
    return { marks: marks.length, belowRods: marks.every(mark => rods.every(rod => rod > mark)),
      aboveSurface: surface >= 0 && marks.every(mark => mark > surface) }
  })).toEqual({ marks: 5, belowRods: true, aboveSurface: true })
  await p.drag(central, 0, 2)
  await expect.poll(() => p.geometry(central)).toMatchObject({ x: 2, y: 4, width: 3, depth: 1 })
  const menu = await p.menu(central)
  await expect(menu.getByRole('menuitem', { name: 'Clone', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await page.screenshot({ path: 'output/playwright/mathtabla-whole-grouping.png', fullPage: true })

  // Clearing the choice leaves the whole and the rods exactly as they were.
  await grouping.getByRole('button', { name: 'No grouping', exact: true }).click()
  await expect(bands).toHaveCount(0)
  await expect(readouts).toContainText('Covered: 3 of 15 square units')
  await grouping.getByRole('button', { name: '5 groups of 3 (horizontal rows)', exact: true }).click()
  await expect(bands).toHaveCount(5)

  // Removing a D reference removes the whole, so the grouping marks go with it.
  await panel.locator('[data-piece-id]').first().click()
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await expect(readouts).toContainText('Add a rod to the horizontal D track to define the whole area.')
  await expect(bands).toHaveCount(0)
  await expect(panel.locator('[data-math-guide]')).toHaveCount(0)
  await expect(grouping.getByRole('button')).toHaveText(['No grouping'])
  await expect(panel.getByText('Define the whole with both D references before grouping it.', { exact: true })).toBeVisible()
})

test('MathTabla regroups a selected 15-unit array between three fives and five threes', async ({ playground: p, page }) => {
  const { panel, destination } = await whole3by5(p)
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })

  await destination.getByRole('button', { name: 'Central array', exact: true }).click()
  const rods: Locator[] = []
  for (let index = 0; index < 5; index++) rods.push(await p.add('MathTabla', 'three'))

  await rods[0]!.click()
  for (const rod of rods.slice(1)) await rod.click({ modifiers: ['Shift'] })
  await (await p.menu(rods[0]!)).getByRole('menuitem', { name: 'Make a train', exact: true }).click()

  const train = panel.locator('[data-piece-id]').last()
  await expect(panel.locator('[data-piece-id]')).toHaveCount(3)
  await expect(readouts).toContainText('Covered: 3 of 15 square units')

  // Lay the fifteen units out as the 3 × 5 rectangle, then only regroup it.
  const factors = await p.menu(train.locator('.train-part').first())
  await factors.getByRole('menuitem', { name: 'Regroup to factors', exact: true }).hover()
  await page.getByRole('menuitem', { name: '5 rows of 3', exact: true }).click()
  await expect.poll(() => p.geometry(train)).toMatchObject({ x: 2, y: 2, width: 3, depth: 5 })
  await expect(readouts).toContainText('Covered: 15 of 15 square units')

  const id = await train.getAttribute('data-piece-id')
  const fiveThrees = [0, 1, 2, 3, 4].map(y => ({ value: 3, x: 0, y, width: 3, depth: 1 }))
  const threeFives = [0, 1, 2].map(x => ({ value: 5, x, y: 0, width: 1, depth: 5 }))
  expect(await partLayout(train)).toEqual(fiveThrees)

  async function regroup(label: string, keyboard = false) {
    // Keyboard focuses the train itself; a rectangle has one top face per part.
    const menu = await p.menu(keyboard ? train : train.locator('.train-part').first(), keyboard)
    const parent = menu.getByRole('menuitem', { name: 'Regroup selected area', exact: true })
    await expect(parent).toBeEnabled()
    if (keyboard) {
      await parent.focus()
      await parent.press('ArrowRight')
    } else {
      await parent.hover()
    }
    const choice = page.getByRole('menuitemcheckbox', { name: label, exact: true })
    await expect(choice).toBeVisible()
    if (keyboard) await choice.press('Enter')
    else await choice.click()
    await expect(page.getByRole('menu')).toHaveCount(0)
  }

  await regroup('3 groups of 5 (vertical columns)')
  expect(await partLayout(train)).toEqual(threeFives)
  // The boundary is not rotated: still 3 columns by 5 rows, in the same cells.
  await expect.poll(() => p.geometry(train)).toMatchObject({ x: 2, y: 2, width: 3, depth: 5 })
  await expect(train).toHaveAttribute('data-piece-id', id!)
  await expect(train).toHaveClass(/draggable-rod--selected/)
  await expect(panel.locator('[data-piece-id]')).toHaveCount(3)
  await expect(readouts).toContainText('Horizontal reference: N 0, D 3')
  await expect(readouts).toContainText('Vertical reference: N 0, D 5')
  await expect(readouts).toContainText('Whole area: 3 × 5 = 15 square units')
  await expect(readouts).toContainText('Covered: 15 of 15 square units')
  await page.screenshot({ path: 'output/playwright/mathtabla-area-regroup.png', fullPage: true })

  // Capture both arrangements and confirm each one restores.
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await regroup('5 groups of 3 (horizontal rows)', true)
  expect(await partLayout(train)).toEqual(fiveThrees)
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await controls.getByRole('button', { name: 'Step 1', exact: true }).click()
  await expect.poll(() => partLayout(panel.locator('[data-piece-id]').last())).toEqual(threeFives)
  await controls.getByRole('button', { name: 'Step 2', exact: true }).click()
  await expect.poll(() => partLayout(panel.locator('[data-piece-id]').last())).toEqual(fiveThrees)
  await expect(readouts).toContainText('Covered: 15 of 15 square units')
})

const presentations = (panel: Locator) =>
  panel.locator('[data-piece-id]').evaluateAll(elements => elements.map(el => {
    const node = el as HTMLElement
    const cell = parseFloat(getComputedStyle(node.closest('[data-grid-world]')!).getPropertyValue('--cell-size'))
    const surfaces = [...node.querySelectorAll('[data-rod-surface]')]
    return {
      presentation: node.dataset.presentation,
      x: parseFloat(node.style.left) / cell, y: parseFloat(node.style.top) / cell,
      faces: node.querySelectorAll('.face').length,
      labels: surfaces.map(surface => surface.textContent),
      height: parseFloat(getComputedStyle(node.querySelector('.rod')!).getPropertyValue('--h')) / cell,
    }
  }))

/** Screen offset of a piece's interaction surface from its board-plane cell. */
async function surfaceOffset(p: Playground, piece: Locator, cell: { x: number, y: number }) {
  const expected = await p.boardClient('MathTabla', cell)
  const box = await piece.locator('[data-rod-surface]').first().boundingBox()
  if (!box) throw new Error('Missing rod surface')
  const round = (value: number) => Math.round(value) || 0
  return { dx: round(box.x - expected.x), dy: round(box.y - expected.y) }
}

async function place(p: Playground, panel: Locator, destination: string, name: string) {
  await panel.getByRole('group', { name: 'Rod destination', exact: true })
    .getByRole('button', { name: destination, exact: true }).click()
  return p.add('MathTabla', name)
}

test('MathTabla draws denominator references flat and numerator references raised, by track not colour', async ({ playground: p, page }) => {
  const panel = await p.show('MathTabla')

  // The same yellow five in all five destinations.
  for (const destination of ['Horizontal D', 'Vertical D', 'Horizontal N', 'Vertical N', 'Central array']) {
    await place(p, panel, destination, 'five')
  }

  expect(await presentations(panel)).toEqual([
    { presentation: 'flat', x: 2, y: 0, faces: 0, labels: ['5'], height: 0 },
    { presentation: 'flat', x: 0, y: 2, faces: 0, labels: ['5'], height: 0 },
    { presentation: 'raised', x: 2, y: 1, faces: 6, labels: ['5'], height: 1 },
    { presentation: 'raised', x: 1, y: 2, faces: 6, labels: ['5'], height: 1 },
    { presentation: 'raised', x: 2, y: 2, faces: 6, labels: ['5'], height: 1 },
  ])

  // Another colour on the same tracks: the role decides, never the colour.
  await place(p, panel, 'Horizontal D', 'three')
  await place(p, panel, 'Horizontal N', 'three')
  expect((await presentations(panel)).slice(5)).toEqual([
    { presentation: 'flat', x: 7, y: 0, faces: 0, labels: ['3'], height: 0 },
    { presentation: 'raised', x: 7, y: 1, faces: 6, labels: ['3'], height: 1 },
  ])

  // Pixels, not only markup: a flat strip sits on the board plane in both
  // orientations, while a raised reference is lifted and leaned.
  const pieces = panel.locator('[data-piece-id]')
  expect(await surfaceOffset(p, pieces.nth(0), { x: 2, y: 0 })).toEqual({ dx: 0, dy: 0 })
  expect(await surfaceOffset(p, pieces.nth(1), { x: 0, y: 2 })).toEqual({ dx: 0, dy: 0 })
  const raised = await surfaceOffset(p, pieces.nth(2), { x: 2, y: 1 })
  expect(raised.dy).toBeLessThan(-6)
  expect(raised.dx).toBeGreaterThan(1)

  await page.screenshot({ path: 'output/playwright/mathtabla-flat-references.png', fullPage: true })
})

test('MathTabla flat references stay interactive and are re-derived after restore and import', async ({ playground: p, page }, info) => {
  const panel = await p.show('MathTabla')
  const readouts = panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })

  const horizontal = await place(p, panel, 'Horizontal D', 'five')
  const vertical = await place(p, panel, 'Vertical D', 'three')
  await place(p, panel, 'Central array', 'four')
  await expect(readouts).toContainText('Whole area: 5 × 3 = 15 square units')

  // Dragging a flat strip works through the same surface and keeps it flat.
  await p.drag(horizontal, 3, 0)
  await expect.poll(() => p.geometry(horizontal)).toMatchObject({ x: 5, y: 0, width: 5, depth: 1 })
  await expect(horizontal).toHaveAttribute('data-presentation', 'flat')
  await expect(readouts).toContainText('Horizontal reference: N 0, D 5')

  // Cloning follows the track the copy lands on, not the piece it came from.
  await (await p.menu(vertical)).getByRole('menuitem', { name: 'Clone', exact: true }).click()
  const clone = panel.locator('[data-piece-id]').last()
  const cloned = await clone.evaluate(el => ({
    presentation: (el as HTMLElement).dataset.presentation,
    column: parseFloat((el as HTMLElement).style.left)
      / parseFloat(getComputedStyle(el.closest('[data-grid-world]')!).getPropertyValue('--cell-size')),
  }))
  expect(cloned.presentation).toBe(cloned.column === 0 ? 'flat' : 'raised')
  await clone.click()
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await expect(panel.locator('[data-piece-id]')).toHaveCount(3)

  // A compound D train renders every part flat and keeps each part's label.
  const second = await place(p, panel, 'Horizontal D', 'two')
  await horizontal.click()
  await second.click({ modifiers: ['Shift'] })
  await (await p.menu(horizontal)).getByRole('menuitem', { name: 'Make a train', exact: true }).click()
  const train = panel.locator('[data-piece-id]').last()
  await expect(train.locator('.train-part')).toHaveCount(2)
  await expect(train).toHaveAttribute('data-presentation', 'flat')
  await expect(train.locator('.face')).toHaveCount(0)
  await expect(train.locator('[data-rod-surface]')).toHaveText(['2', '5'])
  await expect(readouts).toContainText('Horizontal reference: N 0, D 7')

  const before = await presentations(panel)
  expect(before.map(piece => piece.presentation)).toEqual(['flat', 'raised', 'flat'])

  // Restoration re-derives presentation; no snapshot field carries it.
  const capture = controls.getByRole('button', { name: 'Capture step', exact: true })
  await capture.click()
  await p.drag(panel.locator('[data-piece-id]').nth(1), 2, 1)
  await capture.click()
  await controls.getByRole('button', { name: 'Step 1', exact: true }).click()
  await expect.poll(() => presentations(panel)).toEqual(before)

  const pending = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Export level', exact: true }).click()
  const download = await pending
  const path = info.outputPath(download.suggestedFilename())
  await download.saveAs(path)

  await page.reload()
  await expect(p.panel('Bar').locator('[data-ready="true"]')).toBeVisible({ timeout: 30_000 })
  const reopened = await p.show('MathTabla')
  await reopened.getByLabel('Import level', { exact: true }).setInputFiles(path)
  await reopened.getByRole('group', { name: 'Replace level confirmation', exact: true })
    .getByRole('button', { name: 'Replace', exact: true }).click()
  await expect.poll(() => presentations(reopened)).toEqual(before)
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
