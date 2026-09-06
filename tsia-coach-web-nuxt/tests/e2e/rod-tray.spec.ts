import { test, expect } from '@playwright/test'
import { ariaRod, ariaTray } from '../../app/components/rod/tray/rodTray.types'

test('choosing the five rod adds a five-unit rod to the scene', async ({ page }) => {
  // Stopgap: move this flow to a pinned /practice/:code item when that route ships.
  await page.goto('/dev/rod-canvas-new')
  await expect(page.locator('[data-role="viewport"]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 })

  const sceneRods = page.locator('[data-grid-world] [data-width-px]')
  await expect(sceneRods).toHaveCount(0)

  await page.getByRole('complementary', { name: ariaTray })
    .getByRole('button', { name: ariaRod('five'), exact: true }).click()

  await expect(sceneRods).toHaveCount(1)
  await expect(sceneRods).toHaveAttribute('data-width-px', '180')
  await expect(sceneRods.getByText('5', { exact: true })).toBeVisible()
})
