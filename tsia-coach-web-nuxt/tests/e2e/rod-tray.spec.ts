import { test, expect } from '@playwright/test'
import { ScenePage } from './support/pages/ScenePage'

test('choosing the five rod adds a five-unit rod to the scene', async ({ page }) => {
  // Stopgap: move this flow to a pinned /practice/:code item when that route ships.
  const scene = new ScenePage(page)
  await scene.goto()
  await scene.ready()

  await expect(scene.sceneRods()).toHaveCount(0)

  await scene.trayRod('five').click()

  await expect(scene.sceneRods()).toHaveCount(1)
  await expect(scene.sceneRods()).toHaveAttribute('data-width-px', '180')
  await expect(scene.sceneRodLabel('5')).toBeVisible()
})
