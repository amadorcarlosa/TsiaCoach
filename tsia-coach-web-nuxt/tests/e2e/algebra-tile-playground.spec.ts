import { expect, test, type Locator, type Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/dev/playground')
  await expect(page.getByRole('tabpanel', { name: 'Bar Rod Playground', exact: true }).locator('[data-ready="true"]')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: 'Algebra tiles', exact: true }).click()
  const board = page.getByRole('region', { name: 'Algebra tile playground' })
  await expect(board.locator('[data-ready="true"]')).toBeVisible()
  return board
}

const summary = (board: Locator) => board.getByTestId('algebra-tile-summary')
const tiles = (board: Locator) => board.locator('[data-algebra-tile-id]')
const add = (board: Locator, label: string) => board.getByRole('button', { name: `Add ${label}`, exact: true }).click()

test('builds an expression, removes a zero pair and changes a sign from the menu', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const board = await open(page)

  await add(board, 'x')
  await add(board, 'x')
  await add(board, '−x')
  await add(board, '1')
  await expect(summary(board)).toHaveText('4 objects · Expression: x + 1')

  // A positive and a negative x cancel; the selection decides which pair.
  const positive = tiles(board).nth(0)
  const negative = board.locator('[data-term="x"][data-sign="negative"]')
  await positive.click()
  await negative.click({ modifiers: ['Shift'] })
  await expect(board.locator('[data-algebra-tile-id][aria-pressed="true"]')).toHaveCount(2)
  await board.getByRole('button', { name: 'Remove zero pairs', exact: true }).click()
  await expect(summary(board)).toHaveText('2 objects · Expression: x + 1')

  // The context menu acts on the tile it opened on.
  const one = board.locator('[data-term="one"]')
  await one.click({ button: 'right' })
  const menu = page.getByRole('menu', { name: 'Algebra tile actions' })
  await expect(menu).toBeVisible()
  await menu.getByRole('menuitem', { name: 'Change sign', exact: true }).click()
  await expect(menu).toHaveCount(0)
  await expect(summary(board)).toHaveText('2 objects · Expression: x − 1')
  // Focus returns to the tile the menu opened on.
  await expect(one).toBeFocused()

  expect(errors).toEqual([])
})

test('drags a tile, moves it by keyboard and keeps the board across tab changes', async ({ page }) => {
  const board = await open(page)
  await add(board, '1')
  const tile = tiles(board).first()
  await expect(tile).toHaveAttribute('data-x', '0')

  const box = (await tile.boundingBox())!
  const cell = await board.locator('[data-grid-world]').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--cell-size')))
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + cell * 3, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(tile).toHaveAttribute('data-x', '3')

  await tile.focus()
  await page.keyboard.press('ArrowDown')
  await expect(tile).toHaveAttribute('data-y', '1')

  await page.getByRole('tab', { name: 'Array Rod Playground', exact: true }).click()
  await page.getByRole('tab', { name: 'Algebra tiles', exact: true }).click()
  await expect(tile).toHaveAttribute('data-x', '3')
  await expect(tile).toHaveAttribute('data-y', '1')
  await expect(summary(board)).toHaveText('1 object · Expression: 1')
})

test('a marquee on the empty board selects the tiles it touches', async ({ page }) => {
  const board = await open(page)
  await add(board, '1')
  await add(board, '1')
  await add(board, 'y')

  const origin = (await board.locator('[data-grid-axis="origin"]').boundingBox())!
  const cell = await board.locator('[data-grid-world]').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--cell-size')))
  // The two unit tiles sit at columns 0 and 1 of row 0; start below them so
  // the drag begins on empty board, then sweep up across both.
  await page.mouse.move(origin.x + cell * 0.5, origin.y + cell * 6)
  await page.mouse.down()
  await page.mouse.move(origin.x + cell * 1.5, origin.y + cell * 0.5, { steps: 8 })
  await page.mouse.up()

  await expect(board.locator('[data-term="one"][aria-pressed="true"]')).toHaveCount(2)
  await expect(board.locator('[data-term="y"][aria-pressed="true"]')).toHaveCount(0)
  await board.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(summary(board)).toHaveText('1 object · Expression: y')
})

test('the tray toggle reports its expanded state', async ({ page }) => {
  const board = await open(page)
  const toggle = board.getByRole('button', { name: 'Hide tiles', exact: true })
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(board.getByRole('button', { name: 'Show tiles', exact: true })).toHaveAttribute('aria-expanded', 'false')
  await expect(board.getByRole('button', { name: 'Add x', exact: true })).toBeHidden()
})
