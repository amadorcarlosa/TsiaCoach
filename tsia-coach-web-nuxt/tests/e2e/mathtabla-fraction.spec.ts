import type { Locator } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

const activity = (panel: Locator) =>
  panel.getByRole('group', { name: 'MathTabla activity', exact: true })

const materialChoice = (panel: Locator) =>
  panel.getByRole('group', { name: 'Central material', exact: true })

const readouts = (panel: Locator) =>
  panel.getByRole('group', { name: 'MathTabla reference readouts', exact: true })

async function place(p: Playground, panel: Locator, destination: string, name: string) {
  await panel.getByRole('group', { name: 'Rod destination', exact: true })
    .getByRole('button', { name: destination, exact: true }).click()
  return p.add('MathTabla', name)
}

/** Drags a piece onto a board cell, whatever free cell it spawned on. */
async function moveTo(p: Playground, rod: Locator, x: number, y: number) {
  const at = await p.geometry(rod)
  if (at.x === x && at.y === y) return
  await p.drag(rod, x - at.x, y - at.y)
  await expect.poll(() => p.geometry(rod)).toMatchObject({ x, y })
}

async function chooseMaterial(panel: Locator, label: string) {
  await materialChoice(panel).getByRole('button', { name: label, exact: true }).click()
  await expect(materialChoice(panel).getByRole('button', { name: label, exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
}

/** Every central piece's presentation, role-free view used by several checks. */
const layers = (panel: Locator) =>
  panel.locator('[data-piece-id]').evaluateAll(elements => elements.map(el => {
    const node = el as HTMLElement
    const cell = parseFloat(getComputedStyle(node.closest('[data-grid-world]')!).getPropertyValue('--cell-size'))
    return {
      presentation: node.dataset.presentation,
      inert: node.dataset.layerInert === 'true',
      x: parseFloat(node.style.left) / cell,
      y: parseFloat(node.style.top) / cell,
      units: node.querySelectorAll('.unit').length,
      faces: node.querySelectorAll('.face').length,
    }
  }))

/** The 4 × 6 whole of the acceptance example, in fraction multiplication. */
async function fractionWhole(p: Playground) {
  const panel = await p.show('MathTabla')
  await activity(panel).getByRole('button', { name: 'Fraction multiplication', exact: true }).click()
  await expect(activity(panel).getByRole('button', { name: 'Fraction multiplication', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  await place(p, panel, 'Horizontal D', 'four')
  await place(p, panel, 'Vertical D', 'six')
  await expect(readouts(panel)).toContainText('Whole area: 4 × 6 = 24 square units')

  return panel
}

test('MathTabla fraction multiplication stacks raised numerator rods on flat denominator tiles', async ({ playground: p, page }) => {
  // 1-2. The whole, then six flat purple fours filling it.
  const panel = await fractionWhole(p)
  await expect(readouts(panel)).toContainText('Numerator: 0 of 24 square units')

  await chooseMaterial(panel, 'Denominator tiles')
  const tiles: Locator[] = []
  for (let row = 0; row < 6; row++) {
    const tile = await place(p, panel, 'Central array', 'four')
    await moveTo(p, tile, 2, 2 + row)
    tiles.push(tile)
  }

  // 3. A completely tiled whole selects nothing: tiles are not coverage.
  await expect(readouts(panel)).toContainText('Denominator tiles: 24 of 24')
  await expect(readouts(panel)).toContainText('Numerator: 0 of 24 square units')
  for (const tile of tiles) {
    await expect(tile).toHaveAttribute('data-presentation', 'flat-units')
    await expect(tile.locator('.unit')).toHaveCount(4)
  }

  // 4-6. Three raised rods over the first three tiles: 12 of 24 selected.
  await chooseMaterial(panel, 'Numerator rods')
  const rods: Locator[] = []
  for (let row = 0; row < 3; row++) {
    const rod = await place(p, panel, 'Central array', 'four')
    await moveTo(p, rod, 2, 2 + row)
    rods.push(rod)
    await expect(readouts(panel)).toContainText(`Numerator: ${(row + 1) * 4} of 24 square units`)
  }

  // Both layers exist in the same cells, each with its own appearance.
  for (const rod of rods) {
    await expect(rod).toHaveAttribute('data-presentation', 'raised')
    await expect(rod.locator('.face')).toHaveCount(6)
    await expect(rod.locator('.unit')).toHaveCount(0)
  }
  await expect(panel.locator('[data-piece-id]')).toHaveCount(11)

  // The tiles beneath are untouched and still divided into their ones.
  expect(await layers(panel)).toContainEqual(
    expect.objectContaining({ presentation: 'flat-units', x: 2, y: 2, units: 4, faces: 0 }),
  )
  expect(await layers(panel)).toContainEqual(
    expect.objectContaining({ presentation: 'raised', x: 2, y: 2, units: 0, faces: 6 }),
  )

  // Tiles paint before rods, so the rod is the piece a pointer meets.
  expect(await panel.locator('[data-grid-world]').first().evaluate(world => {
    const order = [...world.querySelectorAll('[data-piece-id]')] as HTMLElement[]
    const flat = order.flatMap((el, index) => el.dataset.presentation === 'flat-units' ? [index] : [])
    const raised = order.flatMap((el, index) => el.dataset.presentation === 'raised' ? [index] : [])
    return flat.every(tile => raised.every(rod => rod > tile))
  })).toBe(true)

  await page.screenshot({ path: 'output/playwright/mathtabla-fraction-light.png', fullPage: true })

  // 7. A fourth rod cannot take cells another rod already selects.
  const extra = await place(p, panel, 'Central array', 'four')
  const before = await p.geometry(extra)
  await p.drag(extra, 2 - before.x, 2 - before.y)
  await expect.poll(() => p.geometry(extra)).toMatchObject({ x: before.x, y: before.y })
  await expect(readouts(panel)).toContainText('Numerator: 16 of 24 square units')
  await expect(extra.locator('[data-piece-id]')).toHaveCount(0)
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await expect(readouts(panel)).toContainText('Numerator: 12 of 24 square units')

  // 8. Moving a rod leaves the tiles alone and preserves the count.
  await moveTo(p, rods[2]!, 2, 7)
  await expect(readouts(panel)).toContainText('Numerator: 12 of 24 square units')
  await expect(readouts(panel)).toContainText('Denominator tiles: 24 of 24')
  await moveTo(p, rods[2]!, 2, 4)

  // 9. Regrouping the whole adds nothing and changes no role or count.
  const grouping = panel.getByRole('group', { name: 'Group the whole', exact: true })
  await grouping.getByRole('button', { name: '6 groups of 4 (horizontal rows)', exact: true }).click()
  await expect(panel.locator('[data-math-group-band]')).toHaveCount(6)
  await expect(readouts(panel)).toContainText('Numerator: 12 of 24 square units')
  await expect(panel.locator('[data-piece-id]')).toHaveCount(11)

  // 10. Capture, restore, export and import preserve both layers.
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  const expected = await layers(panel)
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await expect(controls.getByRole('button', { name: 'Step 1', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')

  // Selecting first: the layout shift from the new step panel otherwise
  // swallows the very next drag.
  await rods[0]!.click()
  await moveTo(p, rods[0]!, 2, 7)
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  await controls.getByRole('button', { name: 'Step 1', exact: true }).click()
  await expect.poll(() => layers(panel)).toEqual(expected)
  await expect(readouts(panel)).toContainText('Numerator: 12 of 24 square units')

  // Both layers stay legible at a phone's landscape size and in dark theme.
  const divisions = panel.locator('[data-piece-id] .unit')
  await page.setViewportSize({ width: 915, height: 412 })
  await expect(divisions).toHaveCount(24)
  await page.screenshot({ path: 'output/playwright/mathtabla-fraction-mobile-landscape.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.getByRole('button', { name: 'Toggle color mode', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)
  await expect(divisions).toHaveCount(24)
  await page.screenshot({ path: 'output/playwright/mathtabla-fraction-dark.png', fullPage: true })
})

test('MathTabla stacks either way round: a tile created or dragged under an existing rod', async ({ playground: p }) => {
  const panel = await fractionWhole(p)

  // The rod first this time, then a tile created into the cells it occupies.
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)
  await expect(readouts(panel)).toContainText('Numerator: 4 of 24 square units')

  await chooseMaterial(panel, 'Denominator tiles')
  const under = await place(p, panel, 'Central array', 'four')
  await expect.poll(() => p.geometry(under)).toMatchObject({ x: 2, y: 2 })
  await expect(under).toHaveAttribute('data-presentation', 'flat-units')
  await expect(rod).toHaveAttribute('data-presentation', 'raised')
  await expect(readouts(panel)).toContainText('Denominator tiles: 4 of 24')
  await expect(readouts(panel)).toContainText('Numerator: 4 of 24 square units')

  // A second tile cannot take those cells: the rod layers, another tile does
  // not. The refusal is the same-role rule, not the stacking rule.
  const second = await place(p, panel, 'Central array', 'four')
  await moveTo(p, second, 2, 5)
  await p.drag(second, 0, -3)
  await expect.poll(() => p.geometry(second)).toMatchObject({ x: 2, y: 5 })
  await expect(panel.getByText('Two denominator pieces cannot share the same cells.')).toBeVisible()

  // Dragged onto a row the rod does not occupy, the same tile moves freely.
  await moveTo(p, second, 2, 4)

  // And a tile dragged under a rod on a free tile row lands beneath it.
  await chooseMaterial(panel, 'Numerator rods')
  const rodBelow = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rodBelow, 2, 4)
  expect(await p.geometry(second)).toMatchObject({ x: 2, y: 4 })
  await expect(readouts(panel)).toContainText('Numerator: 8 of 24 square units')
  await expect(readouts(panel)).toContainText('Denominator tiles: 8 of 24')
})

test('MathTabla only steps aside where the layers actually overlap', async ({ playground: p }) => {
  const panel = await fractionWhole(p)

  await chooseMaterial(panel, 'Denominator tiles')
  const tiles: Locator[] = []
  for (let row = 0; row < 3; row++) {
    const tile = await place(p, panel, 'Central array', 'four')
    await moveTo(p, tile, 2, 2 + row)
    tiles.push(tile)
  }

  await chooseMaterial(panel, 'Numerator rods')
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)

  // Only the tile the rod is standing on waits its turn. Freezing the whole
  // layer would leave most of the board unusable.
  await expect(tiles[0]!).toHaveAttribute('data-layer-inert', 'true')
  await expect(tiles[1]!).not.toHaveAttribute('data-layer-inert', 'true')
  await expect(tiles[2]!).not.toHaveAttribute('data-layer-inert', 'true')

  // An uncovered tile really does still drag while rods are the active layer.
  await moveTo(p, tiles[2]!, 2, 6)
  await expect(readouts(panel)).toContainText('Denominator tiles: 12 of 24')

  // Moving the rod off a tile releases that tile and covers the next one.
  await moveTo(p, rod, 2, 3)
  await expect(tiles[0]!).not.toHaveAttribute('data-layer-inert', 'true')
  await expect(tiles[1]!).toHaveAttribute('data-layer-inert', 'true')
  await moveTo(p, tiles[0]!, 2, 7)
})

test('MathTabla names the layer that is accepting input', async ({ playground: p }) => {
  const panel = await fractionWhole(p)

  // The other layer silently ignores drags, so the board says which is live.
  await expect(panel.getByText(/^Editing numerator rods\./)).toBeVisible()
  await chooseMaterial(panel, 'Denominator tiles')
  await expect(panel.getByText(/^Editing denominator tiles\./)).toBeVisible()

  // The hint belongs to the activity, not to MathTabla as a whole.
  await activity(panel).getByRole('button', { name: 'Area', exact: true }).click()
  await expect(panel.getByText(/^Editing /)).toHaveCount(0)
})

test('MathTabla fraction multiplication keeps roles through export and import', async ({ playground: p, page }, info) => {
  const panel = await fractionWhole(p)

  await chooseMaterial(panel, 'Denominator tiles')
  const tile = await place(p, panel, 'Central array', 'four')
  await moveTo(p, tile, 2, 2)

  await chooseMaterial(panel, 'Numerator rods')
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)
  await expect(readouts(panel)).toContainText('Numerator: 4 of 24 square units')

  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  await controls.getByRole('button', { name: 'Capture step', exact: true }).click()
  const expected = await layers(panel)

  const pending = page.waitForEvent('download')
  await panel.getByRole('button', { name: 'Export level', exact: true }).click()
  const download = await pending
  const path = info.outputPath(download.suggestedFilename())
  await download.saveAs(path)

  // The role is persisted on the train itself, not in a side table.
  const document = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(path, 'utf8')))
  expect(document.board.config.activity).toBe('fraction-multiplication')
  expect(document.steps[0].trains.map((train: { materialRole?: string }) => train.materialRole))
    .toEqual([undefined, undefined, 'denominator', 'numerator'])

  await page.reload()
  await expect(p.panel('Bar').locator('[data-ready="true"]')).toBeVisible({ timeout: 30_000 })
  const reopened = await p.show('MathTabla')

  // A fraction-multiplication level will not load into the area activity.
  await reopened.getByLabel('Import level', { exact: true }).setInputFiles(path)
  await expect(reopened.getByText(/authored for the fraction-multiplication activity/)).toBeVisible()

  // Restore the activity first, then the same file imports and re-derives both
  // layers from the roles it carries.
  await activity(reopened).getByRole('button', { name: 'Fraction multiplication', exact: true }).click()
  await reopened.getByLabel('Import level', { exact: true }).setInputFiles(path)
  await reopened.getByRole('group', { name: 'Replace level confirmation', exact: true })
    .getByRole('button', { name: 'Replace', exact: true }).click()

  await expect.poll(() => layers(reopened)).toEqual(expected)
  await expect(readouts(reopened)).toContainText('Numerator: 4 of 24 square units')
})

test('MathTabla fraction multiplication edits one layer at a time', async ({ playground: p }) => {
  const panel = await fractionWhole(p)

  await chooseMaterial(panel, 'Denominator tiles')
  const tile = await place(p, panel, 'Central array', 'four')
  await moveTo(p, tile, 2, 2)

  await chooseMaterial(panel, 'Numerator rods')
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)

  // Editing numerator rods: the tile beneath is visible but takes no input,
  // and is out of the tab order rather than merely unclickable.
  await expect(tile).toHaveAttribute('data-layer-inert', 'true')
  await expect(tile).toHaveAttribute('tabindex', '-1')
  await expect(tile).toHaveAttribute('aria-label', /On the other layer/)
  await expect(rod).not.toHaveAttribute('data-layer-inert', 'true')
  expect(await tile.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none')

  // Switching layer swaps which one is editable; both stay on the board.
  await chooseMaterial(panel, 'Denominator tiles')
  await expect(rod).toHaveAttribute('data-layer-inert', 'true')
  await expect(tile).not.toHaveAttribute('data-layer-inert', 'true')
  await expect(tile).toHaveAttribute('tabindex', '0')

  // The underlying tile is selectable and operable once its layer is active.
  await tile.click()
  await expect(tile).toHaveClass(/draggable-rod--selected/)
  const menu = await p.menu(tile)
  await expect(menu.getByRole('menuitemcheckbox', { name: /^Use as denominator tiles/ })).toBeChecked()
  // Conversion is validated like any other action: making this tile a
  // numerator would put two numerators on the same cells.
  await expect(menu.getByRole('menuitemcheckbox', { name: /^Use as numerator rods/ })).toBeDisabled()
  await p.page.keyboard.press('Escape')

  // With the rod moved aside the conversion is offered, and recounted at once.
  await chooseMaterial(panel, 'Numerator rods')
  await moveTo(p, rod, 2, 4)
  await chooseMaterial(panel, 'Denominator tiles')
  await expect(readouts(panel)).toContainText('Numerator: 4 of 24 square units')

  await (await p.menu(tile)).getByRole('menuitemcheckbox', { name: /^Use as numerator rods/ }).click()
  await expect(readouts(panel)).toContainText('Numerator: 8 of 24 square units')
  await expect(readouts(panel)).toContainText('Denominator tiles: 0 of 24')
  await expect(tile).toHaveAttribute('data-presentation', 'raised')
})

test('MathTabla area activity keeps its existing rules, controls and readouts', async ({ playground: p }) => {
  const panel = await p.show('MathTabla')

  // The ordinary activity is the default and exposes no material choice.
  await expect(activity(panel).getByRole('button', { name: 'Area', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(materialChoice(panel)).toHaveCount(0)

  await place(p, panel, 'Horizontal D', 'four')
  await place(p, panel, 'Vertical D', 'six')
  await expect(readouts(panel)).toContainText('Covered: 0 of 24 square units')
  await expect(readouts(panel)).not.toContainText('Denominator tiles:')
  await expect(readouts(panel)).not.toContainText('Numerator:')

  // Two central pieces cannot share cells here, and the appearance is the
  // flat unit presentation this activity already had.
  const first = await place(p, panel, 'Central array', 'four')
  await moveTo(p, first, 2, 2)
  await expect(first).toHaveAttribute('data-presentation', 'flat-units')
  await expect(readouts(panel)).toContainText('Covered: 4 of 24 square units')

  const second = await place(p, panel, 'Central array', 'four')
  const before = await p.geometry(second)
  await p.drag(second, 2 - before.x, 2 - before.y)
  await expect.poll(() => p.geometry(second)).toMatchObject({ x: before.x, y: before.y })

  // No piece carries a role, so none is inert.
  expect((await layers(panel)).some(piece => piece.inert)).toBe(false)
})

test('MathTabla refuses an activity switch that a layered scene would break', async ({ playground: p }) => {
  const panel = await fractionWhole(p)

  await chooseMaterial(panel, 'Denominator tiles')
  const tile = await place(p, panel, 'Central array', 'four')
  await moveTo(p, tile, 2, 2)

  await chooseMaterial(panel, 'Numerator rods')
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)

  // The area activity rejects the overlap, so the switch is refused outright
  // rather than deleting or flattening the stacked material.
  await activity(panel).getByRole('button', { name: 'Area', exact: true }).click()
  await expect(panel.getByText(/The board cannot move to Area/)).toBeVisible()
  await expect(activity(panel).getByRole('button', { name: 'Fraction multiplication', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(panel.locator('[data-piece-id]')).toHaveCount(4)
  await expect(readouts(panel)).toContainText('Numerator: 4 of 24 square units')

  // Separating the layers makes the same switch legal.
  await chooseMaterial(panel, 'Denominator tiles')
  await tile.click()
  await panel.getByRole('button', { name: 'Remove selected rod', exact: true }).click()
  await activity(panel).getByRole('button', { name: 'Area', exact: true }).click()
  await expect(activity(panel).getByRole('button', { name: 'Area', exact: true }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect(readouts(panel)).toContainText('Covered: 4 of 24 square units')
})

test('MathTabla fraction multiplication keeps numerator rods inside the whole', async ({ playground: p }) => {
  const panel = await fractionWhole(p)
  const rod = await place(p, panel, 'Central array', 'four')
  await moveTo(p, rod, 2, 2)

  // The whole is four wide: one column right is outside it, so the drag is
  // clamped rather than previewed and snapped back.
  await p.drag(rod, 1, 0)
  await expect.poll(() => p.geometry(rod)).toMatchObject({ x: 2, y: 2 })

  // A rod spanning several tile boundaries is fine: tile edges do not
  // constrain numerator placement, only the grid and the whole do.
  await chooseMaterial(panel, 'Denominator tiles')
  const left = await place(p, panel, 'Central array', 'two')
  await moveTo(p, left, 2, 3)
  const right = await place(p, panel, 'Central array', 'two')
  await moveTo(p, right, 4, 3)

  await chooseMaterial(panel, 'Numerator rods')
  const spanning = await place(p, panel, 'Central array', 'four')
  await moveTo(p, spanning, 2, 3)
  await expect(readouts(panel)).toContainText('Numerator: 8 of 24 square units')
  await expect(readouts(panel)).toContainText('Denominator tiles: 4 of 24')
})
