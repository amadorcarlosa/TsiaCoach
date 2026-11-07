import type { Locator, Page } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

const shots = 'output/playwright/rod-count-solver'

async function openRodCounts(page: Page) {
  await page.getByRole('tab', { name: 'Rod Count Systems', exact: true }).click()
  const panel = page.getByRole('tabpanel', { name: 'Rod Count Systems', exact: true })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('combobox', { name: 'Problem', exact: true })).toHaveValue('rodCountReference')
  return panel
}

const status = (panel: Locator) => panel.locator('[data-systems-status]')
const summary = (panel: Locator, index: 1 | 2) => panel.locator(`[data-systems-count-summary="${index}"]`)
const counts = async (panel: Locator) => [
  await panel.locator('[data-count="x"]').textContent(),
  await panel.locator('[data-count="y"]').textContent(),
]

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

const selectedRod = (panel: Locator) => panel.locator('.draggable-rod--selected').first()

type Mode = 'mouse' | 'keyboard' | 'touch'

async function exchangeOnce(page: Page, panel: Locator, mode: Mode, p: Playground, screenshot?: string) {
  await panel.getByRole('button', { name: 'Select 8 x rods to exchange', exact: true }).click()
  await expect(panel.locator('.draggable-rod--selected')).toHaveCount(8)
  const rod = selectedRod(panel)
  const surface = await reveal(page, rod)
  let menu: Locator
  if (mode === 'keyboard') menu = await p.menu(rod, true)
  else if (mode === 'touch') menu = await p.menuByTouch(rod)
  else {
    await surface.click({ button: 'right' })
    menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
  }
  // Opening the menu on a selected rod keeps the whole selection.
  await expect(panel.locator('.draggable-rod--selected')).toHaveCount(8)
  const item = menu.getByRole('menuitem', { name: /^Exchange x rods for equal-area y rods/ })
  if (mode === 'keyboard') {
    await item.focus()
    await page.keyboard.press('Enter')
  } else {
    await item.click()
  }
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('Remove 8 x rods (3-rods): 8 × 3 = 24 cells.')
  await expect(dialog).toContainText('Add 3 y rods (8-rods): 3 × 8 = 24 cells.')
  await expect(panel.locator('[data-systems-ghost="added"]')).toHaveCount(3)
  if (screenshot) await page.screenshot({ path: `${shots}/${screenshot}.png` })
  const confirm = dialog.getByRole('button', { name: 'Exchange rods', exact: true })
  if (mode === 'keyboard') {
    await confirm.focus()
    await page.keyboard.press('Enter')
  } else {
    await confirm.click()
  }
  await expect(dialog).toBeHidden()
  await expect(panel.locator('[data-systems-ghost]')).toHaveCount(0)
}

test.describe('rod-count systems solver', () => {
  test('walks 3x + 8y = 71, 9x + 4y = 73 through (21,1), (13,4), (5,7) by context-menu exchanges', async ({ playground: p, page }) => {
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

    await exchangeOnce(page, panel, 'mouse', p, '03-exchange-preview')
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
    await expect(summary(panel, 1)).toContainText('39 + 32 = 71')
    await expect(summary(panel, 2)).toContainText('117 + 16 = 133')
    await expect(panel.locator('[data-systems-history]')).toContainText('(21, 1) → (13, 4)')
    await page.screenshot({ path: `${shots}/04-second-candidate.png` })

    await exchangeOnce(page, panel, 'mouse', p)
    await expect.poll(() => counts(panel)).toEqual(['5', '7'])
    await expect(summary(panel, 1)).toContainText('3(5) + 8(7) = 71')
    await expect(summary(panel, 1)).toContainText('15 + 56 = 71')
    await expect(summary(panel, 2)).toContainText('9(5) + 4(7) = 73')
    await expect(summary(panel, 2)).toContainText('45 + 28 = 73')
    await expect(summary(panel, 2)).toHaveAttribute('data-correctness', 'correct')
    await expect(status(panel)).toHaveAttribute('data-phase', 'solved')
    await expect(status(panel)).toContainText('Both equations hold with x = 5 and y = 7')
    await page.screenshot({ path: `${shots}/05-solved.png` })

    // Solution stops the conversion.
    const menu = await p.menu(panel.locator('[data-piece-id="start-x"]'))
    const exchange = menu.getByRole('menuitem', { name: /^Exchange x rods/ })
    await expect(exchange).toHaveAttribute('aria-disabled', 'true')
    await expect(exchange).toContainText('Both equations already hold')
    await page.keyboard.press('Escape')
  })

  test('exchanges with the keyboard', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await exchangeOnce(page, panel, 'keyboard', p)
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
    await expect(summary(panel, 2)).toContainText('= 133')
  })

  test('exchanges by touch long-press', async ({ playground: p, page }) => {
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await exchangeOnce(page, panel, 'touch', p)
    await expect.poll(() => counts(panel)).toEqual(['13', '4'])
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
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(0)
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
    const item = menu.getByRole('menuitem', { name: /^Exchange x rods/ })
    await expect(item).toHaveAttribute('aria-disabled', 'true')
    await expect(item).toContainText('Select exactly 8 x rods (3-rods) to exchange; 1 selected.')
    await page.keyboard.press('Escape')
  })

  test('derived rods stay aligned at every zoom on a scrolled board', async ({ playground, page }) => {
    void playground
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    for (const zoom of ['0.5', '1', '2']) {
      await panel.getByLabel('Zoom', { exact: true }).selectOption(zoom)
      const viewport = panel.locator('.systems-viewport')
      await viewport.evaluate(element => {
        element.scrollLeft = 12
        element.scrollTop = 12
      })
      const rod = (await panel.locator('[data-piece-id="start-x"]').boundingBox())!
      const derived = (await panel.locator('[data-systems-derived="derived-x-0"]').boundingBox())!
      expect(Math.abs(rod.x - derived.x), `zoom ${zoom}`).toBeLessThan(2)
      expect(derived.y).toBeGreaterThan(rod.y)
    }
  })

  test('new problem, reset, and capture/restore regenerate the check', async ({ playground, page }) => {
    void playground
    const panel = await openRodCounts(page)
    await buildFirstCandidate(panel)
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await panel.locator('[data-piece-id="start-x"]').click()

    await panel.getByText('Board options', { exact: true }).click()
    await panel.getByRole('button', { name: 'Reset board', exact: true }).click()
    await expect.poll(() => counts(panel)).toEqual(['1', '1'])
    await expect(summary(panel, 2)).toContainText('= 13')

    // Capture the reset board as Step 2, then return to Step 1: it restores
    // Equation 1's rods and rebuilds Equation 2 from their counts.
    await panel.getByRole('button', { name: 'Capture step', exact: true }).click()
    await panel.locator('[data-piece-id="start-x"]').click()
    await panel.getByRole('button', { name: /^Step 1/ }).click()
    await expect.poll(() => counts(panel)).toEqual(['21', '1'])
    await expect(summary(panel, 2)).toContainText('189 + 4 = 193')
    await expect(panel.locator('[data-systems-derived]')).toHaveCount(22)

    // A new problem is refused while there is work, then generated cleanly.
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
