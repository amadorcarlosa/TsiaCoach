import {
    test as base,
    expect,
    type Locator,
} from '@playwright/test'

type Position = { x: number; y: number }

type TablaFixture = {
    pieces: Locator
    removeButton: Locator
    message: Locator
    addRod: (name: string) => Promise<Locator>
    dragBy: (
        rod: Locator,
        dx: number,
        dy: number,
    ) => Promise<void>
    expectPosition: (
        rod: Locator,
        position: Position,
    ) => Promise<void>
    expectRenderedAt: (
        rod: Locator,
        position: Position,
    ) => Promise<void>
}

export const test = base.extend<{ tabla: TablaFixture }>({
    tabla: async ({ page }, use) => {
        await page.goto('/dev/rod-tabla-playground')

        const world = page.locator('[data-grid-world]')
        const pieces = world.locator('[data-piece-id]')

        await expect(world).toBeVisible()

        async function axes() {
            return world.evaluate(element => {
                function point(name: string) {
                    const marker = element.querySelector(
                        `[data-grid-axis="${name}"]`,
                    )

                    if (!marker) {
                        throw new Error(`Missing grid axis: ${name}`)
                    }

                    const rect = marker.getBoundingClientRect()
                    return { x: rect.left, y: rect.top }
                }

                const origin = point('origin')
                const x = point('x')
                const y = point('y')

                return {
                    origin,
                    x: { x: x.x - origin.x, y: x.y - origin.y },
                    y: { x: y.x - origin.x, y: y.y - origin.y },
                }
            })
        }

        const tabla: TablaFixture = {
            pieces,

            removeButton: page.getByRole('button', {
                name: 'Remove selected rod',
                exact: true,
            }),

            message: page.locator('.placement-message'),

            async addRod(name) {
                const before = await pieces.count()

                await page.getByRole('button', {
                    name: `Choose ${name} rod`,
                    exact: true,
                }).click()

                await expect(pieces).toHaveCount(before + 1)

                const id = await pieces.last().getAttribute('data-piece-id')
                if (!id) throw new Error('Created rod has no ID')

                // Keep targeting this rod even when another is removed.
                return pieces.filter({
                    has: page.locator(':scope'),
                }).and(page.locator(`[data-piece-id="${id}"]`))
            },

            async dragBy(rod, dx, dy) {
                await rod.scrollIntoViewIfNeeded()

                const frame = await axes()
                const face = await rod.locator('.face.top').boundingBox()
                if (!face) throw new Error('Rod top face is not visible')

                const start = {
                    x: face.x + face.width / 2,
                    y: face.y + face.height / 2,
                }

                await page.mouse.move(start.x, start.y)
                await page.mouse.down()

                try {
                    await page.mouse.move(
                        start.x + dx * frame.x.x + dy * frame.y.x,
                        start.y + dx * frame.x.y + dy * frame.y.y,
                        { steps: 20 },
                    )
                } finally {
                    await page.mouse.up()
                }
            },

            async expectPosition(rod, position) {
                await expect(rod).toHaveAttribute(
                    'data-grid-x',
                    String(position.x),
                )
                await expect(rod).toHaveAttribute(
                    'data-grid-y',
                    String(position.y),
                )
            },

            async expectRenderedAt(rod, position) {
                // Check actual geometry, not just accepted props.
                await expect.poll(async () => {
                    const frame = await axes()
                    const rect = await rod.boundingBox()
                    if (!rect) return Number.POSITIVE_INFINITY

                    const expectedX =
                        frame.origin.x +
                        position.x * frame.x.x +
                        position.y * frame.y.x

                    const expectedY =
                        frame.origin.y +
                        position.x * frame.x.y +
                        position.y * frame.y.y

                    return Math.max(
                        Math.abs(rect.x - expectedX),
                        Math.abs(rect.y - expectedY),
                    )
                }).toBeLessThan(1)
            },
        }

        await use(tabla)
    },
})

export { expect } from '@playwright/test'