import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures/playground-fixture'

const shots = 'output/playwright/systems-of-equations'

async function openSystems(page: Page) {
  await page.getByRole('tab', { name: 'Systems of Equations Playground', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Systems of Equations Playground', exact: true })
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-piece-id]')).toHaveCount(0)
  return panel
}

const readout = (panel: Locator) => panel.getByRole('region', { name: 'Equations' })
const status = (panel: Locator) => panel.locator('[data-systems-status]')

async function destination(panel: Locator, label: string) {
  await panel.getByRole('combobox', { name: 'Rod destination', exact: true }).selectOption({ label })
}

/** Adds a rod to the current destination and returns the new piece. */
async function add(panel: Locator, name: string) {
  const choice = panel.getByRole('button', { name: `Choose ${name} rod`, exact: true })
  if (!await choice.isVisible()) await panel.getByRole('button', { name: /show rods/i }).click()
  const pieces = panel.locator('[data-piece-id]')
  const ids = () => pieces.evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.pieceId!))
  const before = new Set(await ids())
  await choice.click()
  await expect(pieces).toHaveCount(before.size + 1)
  const id = (await ids()).find(value => !before.has(value))!
  return panel.locator(`[data-piece-id="${id}"]`)
}

/** Waits until the window and board stop scrolling; menus close on scroll. */
async function settleScroll(page: Page) {
  let last = ''
  await expect.poll(async () => {
    const now = await page.evaluate(() => JSON.stringify([window.scrollY,
      ...[...document.querySelectorAll('.systems-viewport')].map(el => [el.scrollTop, el.scrollLeft])]))
    const stable = now === last
    last = now
    return stable
  }, { intervals: [100] }).toBe(true)
}

async function menuOn(page: Page, rod: Locator) {
  const surface = rod.locator('[data-rod-surface]').first()
  await surface.scrollIntoViewIfNeeded()
  // Keep the board below the sticky header after inspecting feedback below it.
  await surface.evaluate(el => {
    const viewport = el.closest('.systems-viewport')
    if (viewport) window.scrollBy(0, viewport.getBoundingClientRect().top - 120)
  })
  await settleScroll(page)
  await surface.click({ button: 'right' })
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  return menu
}

async function command(page: Page, rod: Locator, label: string, confirm: string, screenshot?: string) {
  const menu = await menuOn(page, rod)
  await menu.getByRole('menuitem', { name: label }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keep rods' })).toBeFocused()
  if (screenshot) await page.screenshot({ path: `${shots}/${screenshot}.png` })
  await dialog.getByRole('button', { name: confirm, exact: true }).click()
  await expect(dialog).toBeHidden()
}

/** The first piece in a lane region, by its data-systems-region box. */
async function pieceIn(panel: Locator, regionId: string) {
  const region = (await panel.locator(`[data-systems-region="${regionId}"]`).boundingBox())!
  for (const piece of await panel.locator('[data-piece-id]').all()) {
    const box = (await piece.boundingBox())!
    if (box.y >= region.y - 2 && box.y < region.y + region.height - 2) return piece
  }
  throw new Error(`No piece in ${regionId}`)
}

test.describe('systems of equations playground', () => {
  test('builds x=8, y=2, tests it against equation 2, then finds the solution', async ({ playground, page }) => {
    void playground
    const panel = await openSystems(page)
    await expect(readout(panel).getByText('Equation 1: 3x + 5y = 34', { exact: true })).toBeVisible()
    await expect(status(panel)).toHaveText('0 of 2 equations hold.')
    await page.screenshot({ path: `${shots}/incomplete.png` })

    // Equation 1: three rows of 8 and five rows of 2, built with Repeat row.
    await destination(panel, 'Eq 1: x (3 rows)')
    const eight = await add(panel, 'eight')
    await command(page, eight, 'Repeat row into this group', 'Repeat row')
    await destination(panel, 'Eq 1: y (5 rows)')
    const two = await add(panel, 'two')
    await command(page, two, 'Repeat row into this group', 'Repeat row')
    await expect(panel.getByText('Equation 1: 34 of 34 cells. Both groups form rectangles.')).toBeVisible()

    // Test the candidate in equation 2: preview first, then build it.
    const row = await pieceIn(panel, 'equation-1:x')
    const menu = await menuOn(page, row)
    await menu.getByRole('menuitem', { name: 'Test candidate in other equation' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Equation 2 would have 36 of 22 cells: 14 excess.')
    await expect(panel.locator('[data-systems-ghost]')).toHaveCount(6)
    await page.screenshot({ path: `${shots}/context-menu-preview.png` })
    await dialog.getByRole('button', { name: 'Build candidate', exact: true }).click()
    await expect(panel.getByText('Equation 2: 36 of 22 cells; 14 excess. Both groups form rectangles.')).toBeVisible()
    await expect(status(panel)).toHaveText('1 of 2 equations hold.')
    await expect(panel.locator('[data-systems-ghost]')).toHaveCount(0)
    await page.screenshot({ path: `${shots}/rejected-candidate.png` })

    // Rearrange equation 1's 34 cells; nothing names the right split.
    const again = await menuOn(page, await pieceIn(panel, 'equation-1:x'))
    await again.getByRole('menuitem', { name: 'Redistribute this equation’s area' }).hover()
    await expect(page.getByRole('menuitem', { name: 'x = 8, y = 2' })).toBeVisible()
    await page.getByRole('menuitem', { name: 'x = 3, y = 5' }).click()
    await expect(page.getByRole('dialog')).toContainText('The equation keeps its area.')
    await page.getByRole('dialog').getByRole('button', { name: 'Redistribute', exact: true }).click()
    await expect(panel.getByText('Equation 1: 34 of 34 cells. Both groups form rectangles.')).toBeVisible()
    await panel.getByText('Shape and agreement feedback', { exact: true }).click()
    await expect(panel.getByText('Both x groups are rectangles, but their lengths disagree (3 and 8).')).toBeVisible()

    await command(page, await pieceIn(panel, 'equation-1:x'), 'Test candidate in other equation', 'Build candidate')
    await expect(status(panel)).toHaveText('Both equations hold with the same x and the same y.')
    await page.screenshot({ path: `${shots}/solved.png` })
  })

  test('long variable: a 10-and-4 train repeats into rows of 14', async ({ playground, page }) => {
    void playground
    const panel = await openSystems(page)
    await panel.getByRole('combobox', { name: 'Problem', exact: true }).selectOption('longVariable')
    await expect(readout(panel).getByText('Equation 1: 2x + y = 32', { exact: true })).toBeVisible()

    await destination(panel, 'Eq 1: x (2 rows)')
    const ten = await add(panel, 'ten')
    const four = await add(panel, 'four')
    await ten.locator('[data-rod-surface]').click()
    await four.locator('[data-rod-surface]').click({ modifiers: ['Shift'] })
    const join = await menuOn(page, four)
    await join.getByRole('menuitem', { name: 'Make a train', exact: true }).click()
    const train = await pieceIn(panel, 'equation-1:x')
    await expect(train).toHaveAttribute('aria-label', /^Train, value 14, 2 parts/)
    await command(page, train, 'Repeat row into this group', 'Repeat row', 'long-variable-preview')

    await destination(panel, 'Eq 1: y (1 row)')
    await add(panel, 'four')
    await expect(panel.getByText('Equation 1: 32 of 32 cells. Both groups form rectangles.')).toBeVisible()
    await command(page, await pieceIn(panel, 'equation-1:x'), 'Test candidate in other equation', 'Build candidate')
    await expect(status(panel)).toHaveText('Both equations hold with the same x and the same y.')
    // Every rod stays within the catalog even though x is 14.
    const values = await panel.locator('[data-part-value]').evaluateAll(parts => parts.map(part => Number((part as HTMLElement).dataset.partValue)))
    expect(Math.max(...values)).toBeLessThanOrEqual(10)
    await page.screenshot({ path: `${shots}/long-variable-solved.png` })
  })

  test('menus explain refusals; keyboard and background menus work', async ({ playground, page }) => {
    void playground
    const panel = await openSystems(page)
    await destination(panel, 'Eq 1: x (3 rows)')
    const four = await add(panel, 'four')

    await four.focus()
    await four.press('Shift+F10')
    const menu = page.getByRole('menu')
    const arrange = menu.getByRole('menuitem', { name: /Arrange as coefficient rows/ })
    await expect(arrange).toHaveAttribute('aria-disabled', 'true')
    await expect(arrange).toContainText('This group has 4 cells; 4 cannot form 3 equal whole-number rows.')
    await page.keyboard.press('Escape')

    // Joining across groups is refused.
    await destination(panel, 'Eq 1: y (5 rows)')
    const two = await add(panel, 'two')
    await four.locator('[data-rod-surface]').click({ modifiers: ['Shift'] })
    const join = await menuOn(page, two)
    await expect(join.getByRole('menuitem', { name: /^Make a train/ })).toContainText('Select rods from one group.')
    await page.keyboard.press('Escape')

    // Right-click on an empty lane: choose it as the destination.
    const laneElement = panel.locator('[data-systems-region="equation-2:y"]')
    await laneElement.scrollIntoViewIfNeeded()
    const lane = (await laneElement.boundingBox())!
    await settleScroll(page)
    await page.mouse.click(lane.x + lane.width - 20, lane.y + 10, { button: 'right' })
    await page.getByRole('menu').getByRole('menuitem', { name: /Add rods here/ }).click()
    await expect(panel.getByRole('combobox', { name: 'Rod destination', exact: true })).toHaveValue('equation-2:y')

    // Switching problems is refused while the board has work on it.
    await panel.getByRole('combobox', { name: 'Problem', exact: true }).selectOption('longVariable')
    await expect(panel.getByText('Clear the board and delete captured steps before switching problems.')).toBeVisible()
    await expect(readout(panel).getByText('Equation 1: 3x + 5y = 34', { exact: true })).toBeVisible()
  })

  for (const zoom of ['0.25', '0.5', '1', '2']) {
    test(`menu anchors to the rod at ${Number(zoom) * 100}% zoom on a scrolled board`, async ({ playground, page }) => {
      void playground
      const panel = await openSystems(page)
      await destination(panel, 'Eq 1: x (3 rows)')
      const rod = await add(panel, 'three')
      await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
      const viewport = panel.locator('.systems-viewport')
      // Scroll whenever the board overflows; at small zoom it fits and cannot.
      const scrolled = await viewport.evaluate(element => {
        element.scrollLeft = 8
        element.scrollTop = 8
        return { overflows: element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth,
          offset: element.scrollLeft + element.scrollTop }
      })
      if (scrolled.overflows) expect(scrolled.offset).toBeGreaterThan(0)
      const menu = await menuOn(page, rod)
      const box = (await rod.locator('[data-rod-surface]').boundingBox())!
      const anchored = (await menu.boundingBox())!
      expect(Math.abs(anchored.x - box.x)).toBeLessThan(80)
      // Below the rod, or flipped above it near the bottom of the window.
      const below = anchored.y - (box.y + box.height)
      const above = box.y - (anchored.y + anchored.height)
      // A raised rod's lean lifts its cap a few pixels past its footprint.
      expect((below > -12 && below < 60) || (above > -12 && above < 60)).toBe(true)
      await page.keyboard.press('Escape')
    })
  }
})


test('systems opens as one compact grid with adjacent coefficient row bands', async ({ playground, page }) => {
  void playground
  const panel = await openSystems(page)
  const regions = panel.locator('[data-continuous-band]')
  await expect(regions).toHaveCount(4)
  await expect(panel.locator('.sys-lane-label')).toHaveCount(14)
  const boxes = await regions.evaluateAll(elements => elements.map(el => {
    const box = el.getBoundingClientRect()
    return { top: box.top, bottom: box.bottom, left: box.left, width: box.width }
  }))
  expect(boxes[0]!.bottom).toBeCloseTo(boxes[1]!.top, 0)
  expect(boxes[2]!.bottom).toBeCloseTo(boxes[3]!.top, 0)
  expect(boxes.every(box => box.left === boxes[0]!.left && box.width === boxes[0]!.width)).toBe(true)
  const viewport = await panel.locator('.systems-viewport').boundingBox()
  expect(boxes[3]!.bottom).toBeLessThan(viewport!.y + viewport!.height)
  await expect(panel.locator('.sys-details')).not.toHaveAttribute('open')
  await page.screenshot({ path: `${shots}/continuous-grid.png` })
})
