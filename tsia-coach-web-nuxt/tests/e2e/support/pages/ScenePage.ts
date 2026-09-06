import { expect, type Page } from '@playwright/test'
import type { CuisenaireRodNumber } from '~/components/rod/rod.types'
import { ariaRod, ariaTray } from '~/components/rod/tray/rodTray.types'

/** Scene interactions shared by browser specs in `tests/e2e`. */
export class ScenePage {
  constructor(private readonly page: Page) {}

  goto = () => this.page.goto('/dev/rod-canvas-new')

  ready = () => expect(this.page.locator('[data-role="viewport"]'))
    .toHaveAttribute('data-ready', 'true', { timeout: 30_000 })

  tray = () => this.page.getByRole('complementary', { name: ariaTray })

  trayRod = (number: CuisenaireRodNumber) => this.tray()
    .getByRole('button', { name: ariaRod(number), exact: true })

  sceneRods = () => this.page.locator('[data-grid-world] [data-width-px]')

  sceneRodLabel = (label: string) => this.sceneRods().getByText(label, { exact: true })
}
