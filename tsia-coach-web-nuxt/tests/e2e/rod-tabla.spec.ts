import { test, expect } from './fixtures/rod-tabla-fixture'

test('rejected overlap returns visually to the accepted position', async ({
                                                                              tabla,
                                                                          }) => {
    const first = await tabla.addRod('six')
    const second = await tabla.addRod('eight')

    await tabla.expectPosition(first, { x: 0, y: 2 })
    await tabla.expectPosition(second, { x: 6, y: 2 })

    // The six-rod would occupy columns 3–9, overlapping the eight.
    await tabla.dragBy(first, 3, 0)

    await expect(tabla.message).toContainText('occupied')
    await tabla.expectPosition(first, { x: 0, y: 2 })
    await tabla.expectRenderedAt(first, { x: 0, y: 2 })
    await tabla.expectPosition(second, { x: 6, y: 2 })

    // A subsequent valid drag proves the rod is still usable.
    await tabla.dragBy(first, 0, 3)

    await tabla.expectPosition(first, { x: 0, y: 5 })
    await tabla.expectRenderedAt(first, { x: 0, y: 5 })
})

test('keyboard movement cannot leave the board', async ({ tabla }) => {
    const rod = await tabla.addRod('six')

    await rod.focus()
    await rod.press('ArrowLeft')

    await expect(tabla.message).toContainText('inside the board')
    await tabla.expectPosition(rod, { x: 0, y: 2 })
    await tabla.expectRenderedAt(rod, { x: 0, y: 2 })
})

test('selection survives toolbar focus and removal affects only that rod', async ({
                                                                                      tabla,
                                                                                  }) => {
    const first = await tabla.addRod('six')
    const second = await tabla.addRod('six')

    await first.focus()

    await expect(first).toHaveClass(/draggable-rod--selected/)
    await expect(second).not.toHaveClass(/draggable-rod--selected/)

    await tabla.removeButton.focus()
    await expect(first).toHaveClass(/draggable-rod--selected/)

    await tabla.removeButton.press('Enter')

    await expect(first).toHaveCount(0)
    await expect(tabla.pieces).toHaveCount(1)
    await tabla.expectPosition(second, { x: 6, y: 2 })
    await expect(tabla.removeButton).toBeDisabled()
})

test('portrait preserves rods and prevents editing', async ({
                                                                page,
                                                                tabla,
                                                            }) => {
    const first = await tabla.addRod('six')
    const second = await tabla.addRod('six')
    await first.focus()

    // Resize the same page: do not reload and lose the board session.
    await page.setViewportSize({ width: 412, height: 915 })

    await expect(first).toHaveAttribute('aria-disabled', 'true')
    await expect(tabla.removeButton).toBeDisabled()

    await page.getByRole('button', {
        name: 'Show rods',
        exact: true,
    }).click()

    await expect(page.getByRole('button', {
        name: 'Choose six rod',
        exact: true,
    })).toBeDisabled()

    // A disabled rod must ignore attempted pointer movement.
    await tabla.dragBy(first, 1, 0)

    await tabla.expectPosition(first, { x: 0, y: 2 })
    await tabla.expectRenderedAt(first, { x: 0, y: 2 })
    await tabla.expectPosition(second, { x: 6, y: 2 })
    await expect(tabla.pieces).toHaveCount(2)

    await page.setViewportSize({ width: 915, height: 412 })

    await expect(first).toHaveAttribute('aria-disabled', 'false')
    await expect(tabla.removeButton).toBeEnabled()

    await first.focus()
    await first.press('ArrowDown')

    await tabla.expectPosition(first, { x: 0, y: 3 })
    await tabla.expectRenderedAt(first, { x: 0, y: 3 })
})

test.describe('with inertia enabled', () => {
    test.use({
        contextOptions: {
            reducedMotion: 'no-preference',
        },
    })

    test('an invalid throw returns to the committed position', async ({
                                                                          tabla,
                                                                      }) => {
        const rod = await tabla.addRod('six')

        await tabla.dragBy(rod, -2, 0)

        await expect(tabla.message).toContainText('inside the board')
        await tabla.expectPosition(rod, { x: 0, y: 2 })
        await tabla.expectRenderedAt(rod, { x: 0, y: 2 })
    })
})