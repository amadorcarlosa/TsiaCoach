import { test as base, expect, type Locator } from '@playwright/test'

/** One cell on the grid, in grid units. Matches the `data-x` / `data-y` the board renders. */
type Cell = { x: number, y: number }
type Piece = Cell & { length: number }

type RodGridPage = {
  board: () => Locator
  placed: (piece?: Partial<Piece>) => Locator
  waitForBoard: (stepId: string) => Promise<Locator>
  /** Drags a supply piece onto a cell and waits for the server's verdict. */
  drop: (piece: Piece) => Promise<void>
  /** Clicks a reference row (move or select) and waits for the server's verdict. */
  clickRow: (y: number) => Promise<void>
  expectPlaced: (piece: Piece) => Promise<void>
  /** The board reverts a refused piece after half a second; this waits for that. */
  expectReverted: (piece: Partial<Piece>) => Promise<void>
  expectPlacedCount: (count: number) => Promise<void>
}

type Fixtures = {
  rodGrid: RodGridPage
}

const UNIT = 28

function selector(piece: Partial<Piece>): string {
  const attrs = (['length', 'x', 'y'] as const)
    .filter(key => piece[key] !== undefined)
    .map(key => `[data-${key}="${piece[key]}"]`)
    .join('')
  return `[data-role="placed"]${attrs}`
}

export const test = base.extend<Fixtures>({
  rodGrid: async ({ page }, use) => {
    const rodGrid: RodGridPage = {
      board: () => page.locator('.grid-board'),
      placed: piece => rodGrid.board().locator(selector(piece ?? {})),

      waitForBoard: async (stepId) => {
        return await base.step(`RodGrid.waitForBoard: ${stepId}`, async () => {
          const board = page.locator(`.grid-board[data-step-id="${stepId}"]`)
          await expect(board).toBeVisible()
          return board
        })
      },

      drop: async ({ length, x, y }) => {
        await base.step(`RodGrid.drop: ${length} at (${x}, ${y})`, async () => {
          const supply = rodGrid.board().locator(`.supply-piece[data-length="${length}"]`)
          const from = await supply.boundingBox()
          const grid = await rodGrid.board().locator('.grid').boundingBox()
          if (!from || !grid) throw new Error('supply piece or grid not visible')

          const verdict = page.waitForResponse('**/checks')
          await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
          await page.mouse.down()
          await page.mouse.move(from.x + from.width / 2 + 40, from.y + 40, { steps: 4 })
          // Grab point is the piece's centre, so aim the centre at the target cells.
          await page.mouse.move(grid.x + x * UNIT + (length * UNIT) / 2, grid.y + y * UNIT + UNIT / 2, { steps: 12 })
          await page.mouse.up()
          await verdict
        })
      },

      clickRow: async (y) => {
        await base.step(`RodGrid.clickRow: ${y}`, async () => {
          const verdict = page.waitForResponse('**/checks')
          await rodGrid.board().locator(`.row-hit[data-row="${y}"]`).click()
          await verdict
        })
      },

      expectPlaced: async (piece) => {
        await base.step(`RodGrid.expectPlaced: ${piece.length} at (${piece.x}, ${piece.y})`, async () => {
          await expect(rodGrid.placed(piece)).toHaveCount(1)
        })
      },

      expectReverted: async (piece) => {
        await base.step(`RodGrid.expectReverted: ${JSON.stringify(piece)}`, async () => {
          await expect(rodGrid.placed(piece)).toHaveCount(0, { timeout: 3000 })
        })
      },

      expectPlacedCount: async (count) => {
        await base.step(`RodGrid.expectPlacedCount: ${count}`, async () => {
          await expect(rodGrid.placed()).toHaveCount(count)
        })
      },
    }

    await use(rodGrid)
  },
})
