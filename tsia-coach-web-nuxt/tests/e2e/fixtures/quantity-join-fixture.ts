import { test as base, expect } from '@playwright/test'

type QuantityJoinPage = {
  /**
   * Moves a part into the Sum lane by the accessible keyboard path: Enter
   * picks it up, ArrowRight selects the Sum zone, Enter drops it. Waits for
   * the part to be marked joined so a check cannot race the drop.
   */
  movePartToSum: (accessibleName: string | RegExp) => Promise<void>
  check: () => Promise<void>
  expectNotMatchedYet: () => Promise<void>
}

type Fixtures = {
  quantityJoin: QuantityJoinPage
}

export const test = base.extend<Fixtures>({
  quantityJoin: async ({ page }, use) => {
    const quantityJoin: QuantityJoinPage = {
      movePartToSum: async (accessibleName) => {
        await base.step(`QuantityJoin.movePartToSum: ${accessibleName}`, async () => {
          const part = page.getByRole('button', { name: accessibleName })
          await expect(part).toBeVisible()
          await part.focus()
          await part.press('Enter')
          await part.press('ArrowRight')
          await part.press('Enter')
          await expect(part).toHaveClass(/is-joined/)
        })
      },

      check: async () => {
        await base.step('QuantityJoin.check', async () => {
          await page.getByTestId('check-scaffold-response').click()
        })
      },

      expectNotMatchedYet: async () => {
        await base.step('QuantityJoin.expectNotMatchedYet', async () => {
          await expect(page.getByText(/does not match the model yet/i)).toBeVisible()
        })
      },
    }

    await use(quantityJoin)
  },
})
