import { test as base, expect, type Page, type Locator } from '@playwright/test'

export class Playground {
  constructor(readonly page: Page) {}

  panel(kind: 'Bar' | 'Array') {
    return this.page.getByRole('tabpanel', { name: `${kind} Rod Playground`, exact: true })
  }

  async show(kind: 'Bar' | 'Array') {
    await this.page.getByRole('tab', { name: `${kind} Rod Playground`, exact: true }).click()
    await expect(this.panel(kind)).toBeVisible()
    return this.panel(kind)
  }

  async add(kind: 'Bar' | 'Array', name: string) {
    const panel = this.panel(kind)
    const choice = panel.getByRole('button', { name: `Choose ${name} rod`, exact: true })
    if (!await choice.isVisible()) {
      await panel.getByRole('button', { name: /show rods/i }).click()
    }
    const pieces = panel.locator('[data-piece-id]')
    const count = await pieces.count()
    await choice.click()
    await expect(pieces).toHaveCount(count + 1)
    const id = await pieces.last().getAttribute('data-piece-id')
    return panel.locator(`[data-piece-id="${id}"]`)
  }

  async menu(rod: Locator, keyboard = false) {
    if (keyboard) {
      await rod.focus()
      await rod.press('Shift+F10')
    } else {
      await rod.locator('.face.top').click({ button: 'right' })
    }
    const menu = this.page.getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
  }

  async geometry(rod: Locator) {
    return rod.evaluate(el => {
      const world = el.closest('[data-grid-world]') as HTMLElement
      const cell = parseFloat(getComputedStyle(world).getPropertyValue('--cell-size'))
      const html = el as HTMLElement
      const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform)
      return {
        x: parseFloat(html.style.left) / cell,
        y: parseFloat(html.style.top) / cell,
        width: parseFloat(html.style.width) / cell,
        depth: parseFloat(html.style.height) / cell,
        height: parseFloat(getComputedStyle(el.querySelector('.rod')!).getPropertyValue('--h')) / cell,
        offset: Math.max(Math.abs(matrix.m41), Math.abs(matrix.m42)),
      }
    })
  }

  async drag(rod: Locator, dx: number, dy: number) {
    await rod.scrollIntoViewIfNeeded()
    const axes = await rod.evaluate(el => {
      const world = el.closest('[data-grid-world]')!
      const rect = (name: string) => world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const o = rect('origin'), x = rect('x'), y = rect('y')
      return { xx: x.x - o.x, xy: x.y - o.y, yx: y.x - o.x, yy: y.y - o.y }
    })
    const face = await rod.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing rod face')
    const x = face.x + face.width / 2, y = face.y + face.height / 2
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    try {
      await this.page.mouse.move(x + dx * axes.xx + dy * axes.yx, y + dx * axes.xy + dy * axes.yy, { steps: 20 })
    } finally {
      await this.page.mouse.up()
    }
  }
}

export const test = base.extend<{ playground: Playground }>({
  playground: async ({ page }, use) => {
    await page.goto('/dev/playground')
    await expect(page.getByRole('tabpanel', { name: 'Bar Rod Playground', exact: true }).locator('[data-ready="true"]')).toBeVisible({ timeout: 30_000 })
    await use(new Playground(page))
  },
})
export { expect } from '@playwright/test'
