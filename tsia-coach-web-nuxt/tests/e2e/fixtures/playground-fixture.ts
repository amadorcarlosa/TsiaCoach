import { test as base, expect, type CDPSession, type Page, type Locator } from '@playwright/test'

type PlaygroundKind = 'Bar' | 'Array' | 'Fraction' | 'MathTabla'

const playgroundLabel = (kind: PlaygroundKind) =>
  kind === 'MathTabla' ? 'MathTabla Playground' : `${kind} Rod Playground`

/**
 * Drives real multi-touch input through CDP; requires a hasTouch context.
 * Each event lists only the changed points; Chrome keeps the rest stationary.
 */
export class Touch {
  private session: CDPSession | null = null
  private readonly points = new Map<number, { x: number, y: number }>()

  constructor(private readonly page: Page) {}

  private async send(
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    ids: number[],
  ) {
    this.session ??= await this.page.context().newCDPSession(this.page)
    await this.session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: ids.map(id => {
        const point = this.points.get(id)
        if (!point) throw new Error(`Touch ${id} is not down`)
        return { id, x: point.x, y: point.y }
      }),
    })
  }

  async down(id: number, point: { x: number, y: number }) {
    this.points.set(id, point)
    await this.send('touchStart', [id])
  }

  async move(id: number, point: { x: number, y: number }, steps = 8) {
    const from = this.points.get(id)
    if (!from) throw new Error(`Touch ${id} is not down`)
    for (let step = 1; step <= steps; step++) {
      this.points.set(id, {
        x: from.x + (point.x - from.x) * step / steps,
        y: from.y + (point.y - from.y) * step / steps,
      })
      await this.send('touchMove', [id])
    }
  }

  async up(id: number) {
    await this.send('touchEnd', [id])
    this.points.delete(id)
  }
}

export class Playground {
  readonly touch: Touch

  constructor(readonly page: Page) {
    this.touch = new Touch(page)
  }

  panel(kind: PlaygroundKind) {
    return this.page.getByRole('tabpanel', { name: playgroundLabel(kind), exact: true })
  }

  async show(kind: PlaygroundKind) {
    await this.page.getByRole('tab', { name: playgroundLabel(kind), exact: true }).click()
    await expect(this.panel(kind)).toBeVisible()
    return this.panel(kind)
  }

  async add(kind: PlaygroundKind, name: string) {
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

  async menuByTouch(rod: Locator) {
    const face = rod.locator('.face.top')
    const box = await face.boundingBox()
    if (!box) throw new Error('Missing rod face')
    const x = box.x + box.width / 2, y = box.y + box.height / 2
    await face.dispatchEvent('pointerdown', {
      pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    })
    await this.page.waitForTimeout(600)
    await face.dispatchEvent('pointerup', {
      pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y,
    })
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

  /** Client coordinates of a board point, following the board's tilt. */
  async boardClient(kind: PlaygroundKind, point: { x: number, y: number }) {
    return this.panel(kind).locator('[data-grid-world]').first().evaluate((world, point) => {
      const rect = (name: string) => world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const o = rect('origin'), x = rect('x'), y = rect('y')
      return {
        x: o.left + point.x * (x.left - o.left) + point.y * (y.left - o.left),
        y: o.top + point.x * (x.top - o.top) + point.y * (y.top - o.top),
      }
    }, point)
  }

  /** Drags a marquee between two board points, holding any modifiers. */
  async marquee(
    kind: PlaygroundKind,
    from: { x: number, y: number },
    to: { x: number, y: number },
    options: {
      modifiers?: ('Shift' | 'Control')[]
      beforeRelease?: () => Promise<void>
    } = {},
  ) {
    const start = await this.boardClient(kind, from)
    const end = await this.boardClient(kind, to)
    const modifiers = options.modifiers ?? []
    for (const key of modifiers) await this.page.keyboard.down(key)
    try {
      await this.page.mouse.move(start.x, start.y)
      await this.page.mouse.down()
      await this.page.mouse.move(end.x, end.y, { steps: 12 })
      await options.beforeRelease?.()
    } finally {
      await this.page.mouse.up()
      for (const key of modifiers) await this.page.keyboard.up(key)
    }
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
