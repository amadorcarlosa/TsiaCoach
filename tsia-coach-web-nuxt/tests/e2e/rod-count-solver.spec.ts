import type { Locator, Page } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

const shots = 'output/playwright/rod-count-solver'
const conversionShots = 'output/playwright/rod-count-conversion'

async function openRodCounts(page: Page) {
  await page.getByRole('tab', { name: 'Rod Count Systems', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Rod Count Systems', exact: true })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('combobox', { name: 'Problem', exact: true })).toHaveValue('rodCountReference')
  return panel
}

const status = (panel: Locator) => panel.locator('[data-systems-status]')
const summary = (panel: Locator, index: 1 | 2) => panel.locator(`[data-systems-count-summary="${index}"]`)
const workspace = (panel: Locator) => panel.locator('[data-systems-conversion]')
const lowerLabel = (panel: Locator) => panel.locator('[data-systems-lower-label]')
const counts = async (panel: Locator) => [
  await panel.locator('[data-count="x"]').textContent(),
  await panel.locator('[data-count="y"]').textContent(),
]

/** Every rendered rod's ID and placement, for byte-for-byte comparisons. */
const pieces = (panel: Locator) => panel.locator('[data-piece-id]').evaluateAll(elements => elements
  .map(el => {
    const html = el as HTMLElement
    return `${html.dataset.pieceId}@${html.style.left},${html.style.top},${html.style.width},${html.style.height}`
  })
  .sort())

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

/** Brings a rod into view below the sticky header before opening its menu. */
async function reveal(page: Page, rod: Locator) {
  const surface = rod.locator('[data-rod-surface]').first()
  await surface.scrollIntoViewIfNeeded()
  await surface.evaluate(el => {
    const viewport = el.closest('.systems-viewport')
    if (viewport) window.scrollBy(0, viewport.getBoundingClientRect().top - 120)
  })
  await settleScroll(page)
  return surface
}

/** Builds the first candidate from the starting rods: 21 x rods, 1 y rod. */
async function buildFirstCandidate(panel: Locator) {
  for (let index = 0; index < 4; index++) await panel.getByRole('button', { name: 'Add five x rods', exact: true }).click()
  await expect.poll(() => counts(panel)).toEqual(['21', '1'])
}

const selected = (panel: Locator) => panel.locator('.draggable-rod--selected')

type Mode = 'mouse' | 'keyboard' | 'touch'

/** Opens a rod's context menu. A rectangle is targeted by its first part. */
async function openMenu(page: Page, p: Playground, rod: Locator, mode: Mode) {
  await reveal(page, rod)
  if (mode === 'keyboard') return p.menu(rod, true)
  const target = await rod.locator('.train-part').count() > 1 ? rod.locator('.train-part').first() : rod
  return mode === 'touch' ? p.menuByTouch(target) : p.menu(target)
}

async function choose(page: Page, item: Locator, mode: Mode) {
  await expect(item).toBeVisible()
  await expect(item).not.toHaveAttribute('aria-disabled', 'true')
  if (mode === 'keyboard') {
    await item.focus()
    await page.keyboard.press('Enter')
  } else {
    await item.click()
  }
}

async function chooseInSubmenu(page: Page, menu: Locator, parent: string, child: RegExp, mode: Mode, role: 'menuitem' | 'menuitemcheckbox' = 'menuitem') {
  const trigger = menu.getByRole('menuitem', { name: parent, exact: true })
  await expect(trigger).toBeEnabled()
  if (mode === 'keyboard') {
    await trigger.focus()
    await trigger.press('ArrowRight')
  } else {
    await trigger.hover()
  }
  const item = page.getByRole(role, { name: child })
  await choose(page, item, mode)
  await expect(page.getByRole('menu')).toHaveCount(0)
}

/**
 * The full workspace flow for one exchange: select, open the conversion,
 * Create rectangle → 3 columns × 8 rows, Group rectangle → 3 groups of 8,
 * then Apply. Checks that Equation 2 keeps the confirmed check until Apply.
 */
async function convertOnce(page: Page, panel: Locator, p: Playground, mode: Mode, options: {
  confirmed: string
  proposed: string
  lowerTotal: string
  screenshots?: string
  beforeGroup?: (rectangle: Locator) => Promise<void>
}) {
  await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
  await expect(selected(panel)).toHaveCount(8)
  const before = await pieces(panel)
  const lowerBefore = (await summary(panel, 2).textContent())?.match(/\d+ \+ \d+ = \d+/)?.[0] ?? ''

  let menu = await openMenu(page, p, selected(panel).first(), mode)
  // Opening the menu on a selected rod keeps the whole selection, and selection alone changes nothing.
  await expect(selected(panel)).toHaveCount(8)
  expect(await pieces(panel)).toEqual(before)
  await choose(page, menu.getByRole('menuitem', { name: /^Convert selected area… \(8 x rods · 24 cells\)/ }), mode)
  await expect(workspace(panel)).toBeVisible()
  await expect(workspace(panel)).toContainText('8 × 3 = 24 = 3 × 8')
  await expect(lowerLabel(panel)).toHaveText(`Confirmed candidate: ${options.confirmed}`)
  await expect(summary(panel, 2)).toContainText(lowerBefore)
  // The protected context stays visible but takes no input.
  await expect(panel.locator('[data-layer-inert="true"]')).not.toHaveCount(0)
  if (options.screenshots) await page.screenshot({ path: `${conversionShots}/${options.screenshots}-1-baseline.png` })

  menu = await openMenu(page, p, selected(panel).first(), mode)
  await expect(menu.getByRole('menuitem', { name: 'Make a train', exact: true })).toHaveCount(0)
  await chooseInSubmenu(page, menu, 'Create rectangle…', /^3 columns × 8 rows — 24 cells \(suggested\)/, mode)
  await expect(selected(panel)).toHaveCount(1)
  const rectangle = selected(panel).first()
  await expect(rectangle.locator('.train-part')).toHaveCount(8)
  await expect.poll(() => p.geometry(rectangle)).toMatchObject({ width: 3, depth: 8 })
  await expect(panel.locator('[data-systems-conversion-area]')).toContainText('24 cells')
  // The proposed 3 groups of 8 are outlined before choosing them.
  await expect(panel.locator('[data-systems-partition]')).toHaveCount(3)
  await expect(summary(panel, 2)).toContainText(lowerBefore)
  if (options.screenshots) await page.screenshot({ path: `${conversionShots}/${options.screenshots}-2-rectangle.png` })
  await options.beforeGroup?.(rectangle)

  menu = await openMenu(page, p, rectangle, mode)
  await chooseInSubmenu(page, menu, 'Group rectangle', /^3 groups of 8 — vertical columns · target y grouping/, mode, 'menuitemcheckbox')
  await expect(workspace(panel)).toHaveAttribute('data-ready', 'true')
  await expect(panel.locator('[data-systems-partition]')).toHaveCount(0)
  await expect(lowerLabel(panel)).toHaveText(`Confirmed candidate: ${options.confirmed} · Proposed: ${options.proposed}`)
  await expect(summary(panel, 2)).toContainText(lowerBefore)
  if (options.screenshots) await page.screenshot({ path: `${conversionShots}/${options.screenshots}-3-groups.png` })

  if (mode === 'mouse') {
    await workspace(panel).getByRole('button', { name: 'Apply conversion', exact: true }).click()
  } else {
    menu = await openMenu(page, p, selected(panel).first(), mode)
    await choose(page, menu.getByRole('menuitem', { name: /^Apply conversion/ }), mode)
  }
  await expect(workspace(panel)).toHaveCount(0)
  await expect(summary(panel, 2)).toContainText(options.lowerTotal)
  // Three independent, newly created 8-rods are selected.
  await expect(selected(panel)).toHaveCount(3)
  for (const rod of await selected(panel).all()) await expect(rod.locator('.train-part')).toHaveCount(1)
  if (options.screenshots) await page.screenshot({ path: `${conversionShots}/${options.screenshots}-4-applied.png` })
}

test.describe('rod-count systems solver', () => {
  test('walks 3x + 8y = 71, 9x + 4y = 73 through (21,1), (13,4), (5,7) in the conversion workspace', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)

    // Artboard 1: one rod of each type.
    await expect.poll(() => counts(panel)).toEqual(['1', '1'])
    await expect(summary(panel, 1)).toContainText('3(1) + 8(1) = 11')
    await expect(summary(panel, 2)).toContainText('9(1) + 4(1) = 13')
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(2)
    await expect(status(panel)).toHaveAttribute('data-phase', 'building')
    await page.screenshot({ path: `${shots}/01-start.png` })

    // Artboard 4: the first candidate, checked automatically below.
    await buildFirstCandidate(panel)
    await expect(summary(panel, 1)).toContainText('63 + 8 = 71')
    await expect(summary(panel, 1)).toHaveAttribute('data-correctness', 'correct')
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')
    await expect(summary(panel, 2)).toHaveAttribute('data-correctness', 'incorrect')
    await expect(status(panel)).toContainText('120 cells excess')
    await expect(status(panel)).toContainText('not a common solution')
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(22)
    await page.screenshot({ path: `${shots}/02-first-candidate.png` })

    // Derived x columns sit directly under Equation 1's x columns.
    const firstX = (await panel.locator('[data-piece-id="start-x"]').boundingBox())!
    const derivedX = (await panel.locator('[data-systems-derived="derived-x-0"]').boundingBox())!
    expect(Math.abs(firstX.x - derivedX.x)).toBeLessThan(2)

    const unaffected = (await pieces(panel)).filter(item => /^(start-x|start-y)@/.test(item))
    await convertOnce(page, panel, p, 'mouse', {
      confirmed: 'x = 21, y = 1', proposed: 'x = 13, y = 4', lowerTotal: '117 + 16 = 133', screenshots: '01-first',
    })
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
    await expect(summary(panel, 1)).toContainText('39 + 32 = 71')
    await expect(panel.locator('[data-systems-history]')).toContainText('(21, 1) → (13, 4)')
    // Unaffected rods keep their IDs and places.
    for (const item of unaffected) expect(await pieces(panel)).toContain(item)

    // Arrange explicitly, then reproduce the supplied reference layout.
    await panel.getByRole('button', { name: 'Arrange x, then y…', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Arrange rods', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])

    await convertOnce(page, panel, p, 'mouse', {
      confirmed: 'x = 13, y = 4',
      proposed: 'x = 5, y = 7',
      lowerTotal: '45 + 28 = 73',
      screenshots: '02-second',
      beforeGroup: async rectangle => {
        // The reference: five untouched green 3-rods at the left, an eight-row
        // green 24-cell rectangle, four brown 8-rods beside it.
        await expect.poll(() => p.geometry(rectangle)).toMatchObject({ x: 12, y: 0, width: 3, depth: 8 })
        await expect(panel.locator('[data-layer-inert="true"]')).toHaveCount(9)
        await expect(summary(panel, 1)).toContainText('39 + 32 = 71')
        await expect(summary(panel, 1)).toContainText('24 cells being converted: 8 groups of 3 → 3 groups of 8')
        await expect(summary(panel, 2)).toContainText('117 + 16 = 133')
        await page.screenshot({ path: `${conversionShots}/reference-layout.png` })
      },
    })
    await expect.poll(() => counts(panel)).toEqual(['5', '7'])
    await expect(summary(panel, 1)).toContainText('3(5) + 8(7) = 71')
    await expect(summary(panel, 1)).toContainText('15 + 56 = 71')
    await expect(summary(panel, 2)).toContainText('9(5) + 4(7) = 73')
    await expect(summary(panel, 2)).toHaveAttribute('data-correctness', 'correct')
    await expect(status(panel)).toHaveAttribute('data-phase', 'solved')
    await expect(status(panel)).toContainText('Both equations hold with x = 5 and y = 7')
    await page.screenshot({ path: `${shots}/05-solved.png` })

    // The solution stops the conversion.
    const menu = await p.menu(panel.locator('[data-piece-id="start-x"]'))
    const convert = menu.getByRole('menuitem', { name: /^Convert selected area/ })
    await expect(convert).toHaveAttribute('aria-disabled', 'true')
    await expect(convert).toContainText('Both equations already hold')
    await page.keyboard.press('Escape')
  })

  test('converts from the ordinary context menu: lying x rods grouped as 3 groups of 8', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()

    // The old menu keeps Make a train and gains the area tools.
    let menu = await openMenu(page, p, selected(panel).first(), 'mouse')
    await expect(menu.getByRole('menuitem', { name: /^Make a train/ })).toBeVisible()
    await chooseInSubmenu(page, menu, 'Create rectangle…', /^3 columns × 8 rows — 24 cells \(suggested\)/, 'mouse')
    await expect(workspace(panel)).toHaveCount(0)
    // Lay the eight 3-rods out separately, as by hand: Equation 1 is unfinished.
    menu = await openMenu(page, p, selected(panel).first(), 'mouse')
    await choose(page, menu.getByRole('menuitem', { name: 'Undo train', exact: true }), 'mouse')
    await expect(selected(panel)).toHaveCount(8)
    await expect(summary(panel, 1)).toContainText('24 unassigned')
    await expect(lowerLabel(panel)).toHaveText('Previous candidate (x = 21, y = 1) — current material is unfinished')
    await page.screenshot({ path: `${conversionShots}/ordinary-menu-lying.png` })

    // Group the eight separate rods directly: three upright 8-rods, a new candidate.
    menu = await openMenu(page, p, selected(panel).first(), 'mouse')
    await chooseInSubmenu(page, menu, 'Group rectangle', /^3 groups of 8 — vertical columns · target y grouping/, 'mouse', 'menuitemcheckbox')
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
    await expect(summary(panel, 1)).toContainText('39 + 32 = 71')
    await expect(summary(panel, 2)).toContainText('117 + 16 = 133')
    await expect(lowerLabel(panel)).toHaveCount(0)
    await expect(panel.locator('[data-systems-history]')).toContainText('(21, 1) → (13, 4)')
    await page.screenshot({ path: `${conversionShots}/ordinary-menu-grouped.png` })
  })

  test('converts with the keyboard', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await convertOnce(page, panel, p, 'keyboard', { confirmed: 'x = 21, y = 1', proposed: 'x = 13, y = 4', lowerTotal: '= 133' })
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
    // Focus follows the created rods.
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('.draggable-rod--selected') !== null)).toBe(true)
  })

  test('converts by touch long-press', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await convertOnce(page, panel, p, 'touch', { confirmed: 'x = 21, y = 1', proposed: 'x = 13, y = 4', lowerTotal: '= 133' })
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
  })

  test('keeps the board tools on the draft and cancels back to the exact baseline', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
    const sources = await selected(panel).evaluateAll(elements => elements.map(el => (el as HTMLElement).dataset.pieceId!))
    const baseline = await pieces(panel)
    await panel.getByRole('button', { name: 'Convert selected area…', exact: true }).click()
    await expect(workspace(panel)).toBeVisible()

    // Reshape: an 8 × 3 rectangle of three lying 8-rods reads as 3 groups of 8 in rows, not columns.
    let menu = await openMenu(page, p, selected(panel).first(), 'mouse')
    await chooseInSubmenu(page, menu, 'Create rectangle…', /^8 columns × 3 rows — 24 cells/, 'mouse')
    const rectangleId = await selected(panel).first().getAttribute('data-piece-id')
    const rectangle = panel.locator(`[data-piece-id="${rectangleId}"]`)
    await expect.poll(() => p.geometry(rectangle)).toMatchObject({ width: 8, depth: 3 })
    menu = await openMenu(page, p, rectangle, 'mouse')
    await menu.getByRole('menuitem', { name: 'Group rectangle', exact: true }).hover()
    await expect(page.getByRole('menuitemcheckbox', { name: /^8 groups of 3 — vertical columns/ })).toBeVisible()
    await expect(page.getByRole('menuitemcheckbox', { name: /^3 groups of 8 — horizontal rows · current grouping/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(workspace(panel)).toHaveAttribute('data-ready', 'false')

    // Clone it: the workspace now has 48 cells and Apply waits.
    menu = await openMenu(page, p, rectangle, 'mouse')
    await choose(page, menu.getByRole('menuitem', { name: 'Clone', exact: true }), 'mouse')
    await expect(workspace(panel)).toContainText('48 cells in workspace; this exchange requires 24.')
    await expect(workspace(panel).getByRole('button', { name: 'Apply conversion', exact: true })).toBeDisabled()
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')

    // Delete the clone through its menu: availability depends on the area again.
    const clone = panel.locator(`[data-piece-id]:not([data-layer-inert="true"]):not([data-piece-id="${rectangleId}"])`)
    await expect(clone).toHaveCount(1)
    menu = await openMenu(page, p, clone, 'mouse')
    await choose(page, menu.getByRole('menuitem', { name: 'Delete', exact: true }), 'mouse')
    await expect(workspace(panel)).not.toContainText('48 cells')

    // Rotating transposes the whole rectangle: three upright 8-rods, ready to apply.
    menu = await openMenu(page, p, rectangle, 'mouse')
    await choose(page, menu.getByRole('menuitemcheckbox', { name: 'Vertical', exact: true }), 'mouse')
    await expect.poll(() => p.geometry(rectangle)).toMatchObject({ width: 3, depth: 8 })
    await expect(workspace(panel)).toHaveAttribute('data-ready', 'true')
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')

    // Decompose and drag: no longer ready, Equation 2 unchanged throughout.
    menu = await openMenu(page, p, rectangle, 'mouse')
    await choose(page, menu.getByRole('menuitem', { name: 'Regroup to ones', exact: true }), 'mouse')
    await expect(rectangle.locator('.train-part')).toHaveCount(24)
    await expect(workspace(panel)).toHaveAttribute('data-ready', 'false')
    const before = await p.geometry(rectangle)
    await p.drag(rectangle, 2, 0)
    await expect.poll(async () => (await p.geometry(rectangle)).x).toBe(before.x + 2)
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')

    await workspace(panel).getByRole('button', { name: 'Cancel conversion', exact: true }).click()
    await expect(workspace(panel)).toHaveCount(0)
    expect(await pieces(panel)).toEqual(baseline)
    await expect.poll(() => counts(panel)).toEqual(['21', '1'])
    await expect(selected(panel)).toHaveCount(8)
    // Focus returns to the source material.
    await expect.poll(async () => sources.includes(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.pieceId ?? ''))).toBe(true)
  })

  test('labels the previous candidate when free editing leaves unfinished material', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    const rod = panel.locator('[data-piece-id="start-x"]')
    const menu = await openMenu(page, p, rod, 'mouse')
    // Standing the rod as a tower leaves it a 3-rod, but not an upright x rod.
    await choose(page, menu.getByRole('menuitemcheckbox', { name: 'Tower', exact: true }), 'mouse')
    await expect(panel.locator('[data-systems-unassigned]')).toHaveCount(1)
    await expect(summary(panel, 1)).toContainText('3 unassigned')
    await expect(summary(panel, 1)).not.toHaveAttribute('data-correctness', 'correct')
    await expect(lowerLabel(panel)).toHaveText('Previous candidate (x = 21, y = 1) — current material is unfinished')
    await expect(summary(panel, 2)).toContainText('Previous candidate')
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(22)
    await expect(status(panel)).toHaveAttribute('data-phase', 'building')
    await page.screenshot({ path: `${conversionShots}/previous-candidate.png` })
  })

  test('marks residual material unassigned and never treats it as a count (Artboard 2)', async ({ playground, page }) => {
    void playground
    const panel = await openRodCounts(page)
    await panel.getByRole('button', { name: 'Remove one y rod', exact: true }).click()
    for (let index = 0; index < 4; index++) await panel.getByRole('button', { name: 'Add five x rods', exact: true }).click()
    await panel.getByRole('button', { name: 'Add one x rod', exact: true }).click()
    await panel.getByRole('button', { name: 'Add one x rod', exact: true }).click()
    await expect.poll(() => counts(panel)).toEqual(['23', '0'])
    const choice = panel.getByRole('button', { name: 'Choose two rod', exact: true })
    if (!await choice.isVisible()) await panel.getByRole('button', { name: /show rods/i }).click()
    await choice.click()
    await expect(panel.locator('[data-systems-unassigned]')).toHaveCount(1)
    await expect(summary(panel, 1)).toContainText('69 + 0 + 2 = 71')
    await expect(summary(panel, 1)).toContainText('2 unassigned')
    await expect(summary(panel, 1)).not.toHaveAttribute('data-correctness', 'correct')
    await expect(status(panel)).toContainText('2 cells are unassigned material')
    // No candidate has existed on this problem, so nothing is invented.
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(0)
    await expect(summary(panel, 2)).toContainText('Waiting for whole x and y rods')
    await page.screenshot({ path: `${shots}/06-unassigned.png` })
  })

  test('refuses a wrong selection with a reason, and hints progressively', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await panel.getByRole('button', { name: 'Hint', exact: true }).click()
    await expect(panel.locator('[data-systems-hint]')).toContainText('as many x rods')
    await panel.getByRole('button', { name: 'More hint', exact: true }).click()
    await expect(panel.locator('[data-systems-hint]')).toContainText('More x rods fit')

    await buildFirstCandidate(panel)
    const rod = panel.locator('[data-piece-id="start-x"]')
    await reveal(page, rod)
    const menu = await p.menu(rod)
    const item = menu.getByRole('menuitem', { name: /^Convert selected area/ })
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('Select exactly 8 x rods (3-rods) to exchange; 1 selected.')
    await page.keyboard.press('Escape')
  })

  test('derived rods and the workspace outline stay aligned at every zoom on a scrolled board', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
    await panel.getByRole('button', { name: 'Convert selected area…', exact: true }).click()
    const menu = await openMenu(page, p, selected(panel).first(), 'mouse')
    await chooseInSubmenu(page, menu, 'Create rectangle…', /^3 columns × 8 rows/, 'mouse')
    for (const zoom of ['0.5', '1', '2']) {
      await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
      // A camera change never cancels the conversion.
      await expect(workspace(panel)).toBeVisible()
      const viewport = panel.locator('.systems-viewport')
      await viewport.evaluate(element => {
        element.scrollLeft = 12
        element.scrollTop = 12
      })
      const rod = (await panel.locator('[data-piece-id="start-x"]').boundingBox())!
      const derived = (await panel.locator('[data-systems-derived="derived-x-0"]').boundingBox())!
      expect(Math.abs(rod.x - derived.x), `zoom ${zoom}`).toBeLessThan(2)
      expect(derived.y).toBeGreaterThan(rod.y)
      const rectangle = (await selected(panel).first().boundingBox())!
      const outline = (await panel.locator('[data-systems-conversion-area]').boundingBox())!
      expect(Math.abs(rectangle.x - outline.x), `outline zoom ${zoom}`).toBeLessThan(6)
      expect(Math.abs(rectangle.width - outline.width), `outline zoom ${zoom}`).toBeLessThan(8)
    }
  })

  test('reset, capture, restore and tab changes discard the draft and regenerate the check', async ({ playground, page }) => {
    void playground
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    const committed = await pieces(panel)

    // Capture closes an open conversion and saves only committed rods.
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
    await panel.getByRole('button', { name: 'Convert selected area…', exact: true }).click()
    await expect(workspace(panel)).toBeVisible()
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await expect(workspace(panel)).toHaveCount(0)
    expect(await pieces(panel)).toEqual(committed)
    await panel.locator('[data-piece-id="start-x"]').click()

    // Reset closes it too.
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
    await panel.getByRole('button', { name: 'Convert selected area…', exact: true }).click()
    await expect(workspace(panel)).toBeVisible()
    await panel.getByText('Board options', { exact: true }).click()
    await panel.getByRole('button', { name: 'Reset board', exact: true }).click()
    await expect(workspace(panel)).toHaveCount(0)
    await expect.poll(() => counts(panel)).toEqual(['1', '1'])
    await expect(summary(panel, 2)).toContainText('= 13')
    await expect(lowerLabel(panel)).toHaveCount(0)

    // Capture the reset board as Step 2, then return to Step 1: it restores
    // Equation 1's rods and rebuilds Equation 2 from their counts.
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await panel.locator('[data-piece-id="start-x"]').click()
    await panel.getByRole('button', { name: /^Step 1/ }).click()
    await expect.poll(() => counts(panel)).toEqual(['21', '1'])
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(22)

    // Leaving the tab cancels an open conversion with no draft surviving.
    const restored = await pieces(panel)
    await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
    await panel.getByRole('button', { name: 'Convert selected area…', exact: true }).click()
    await expect(workspace(panel)).toBeVisible()
    await page.getByRole('tab', { name: 'Systems of Equations Playground', exact: true }).click()
    await page.getByRole('tab', { name: 'Rod Count Systems', exact: true }).click()
    await expect(workspace(panel)).toHaveCount(0)
    expect(await pieces(panel)).toEqual(restored)

    // A new problem is refused while there is work.
    await panel.getByRole('button', { name: 'New problem', exact: true }).click()
    await expect(panel.getByText('Clear the board and delete captured steps before switching problems.')).toBeVisible()
  })

  test('generates a new problem from a clean board', async ({ playground, page }) => {
    void playground
    const panel = await openRodCounts(page)
    const before = await panel.getByRole('region', { name: 'Equations' }).textContent()
    await panel.getByRole('combobox', { name: 'Difficulty', exact: true }).selectOption('standard')
    await panel.getByRole('button', { name: 'New problem', exact: true }).click()
    await expect(panel.getByText(/^Problem changed to/)).toBeVisible()
    await expect(panel.getByRole('region', { name: 'Equations' })).not.toHaveText(before ?? '')
    await expect(panel.getByRole('combobox', { name: 'Problem', exact: true })).toHaveValue('')
    await expect(panel.getByText('Generated (Standard)')).toBeVisible()
    await expect.poll(() => counts(panel)).toEqual(['1', '1'])
    await page.screenshot({ path: `${shots}/07-generated.png` })
  })

  test('the Systems of Equations tab keeps the row-length board', async ({ playground, page }) => {
    void playground
    await openRodCounts(page)
    await page.getByRole('tab', { name: 'Systems of Equations Playground', exact: true }).click()
    const systems = page.getByRole('tabpanel', { name: 'Systems of Equations Playground', exact: true })
    await expect(systems.getByRole('combobox', { name: 'Problem', exact: true })).toHaveValue('development')
    await expect(systems.getByRole('combobox', { name: 'Rod destination', exact: true })).toBeVisible()
    await expect(systems.locator('[data-piece-id]')).toHaveCount(0)
    await expect(systems.locator('[data-systems-count-panel]')).toHaveCount(0)
  })
})
