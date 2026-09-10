import type { Locator } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

test('bar menu offers removal only and targets the clicked instance', async ({ playground: p }) => {
  const first = await p.add('Bar', 'six')
  const second = await p.add('Bar', 'six')
  await first.focus()
  const menu = await p.menu(second)
  await expect(second).toHaveClass(/--selected/)
  await expect(menu.getByRole('menuitemcheckbox')).toHaveCount(0)
  await expect(menu.getByRole('menuitem')).toHaveCount(6)
  await menu.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(second).toHaveCount(0)
  await expect(first).toBeVisible()
  await expect(p.panel('Bar').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
})

test('bar train renders each part and both parts remain interactive', async ({ playground: p }) => {
  await p.show('Bar')
  const first = await p.add('Bar', 'three')
  const second = await p.add('Bar', 'five')

  await first.click()
  await second.click({ modifiers: ['Shift'] })

  const menu = await p.menu(first)
  await menu.getByRole('menuitem', { name: 'Make a train' }).click()

  const train = p.panel('Bar').locator('[data-piece-id]')
  await expect(train).toHaveCount(1)
  const piece = train.first()

  const parts = train.locator('.train-part')
  await expect(parts).toHaveCount(2)

  const firstPart = parts.nth(0).locator('.face.top')
  const secondPart = parts.nth(1).locator('.face.top')

  await firstPart.click()
  await expect(piece).toHaveClass(/draggable-rod--selected/)

  await secondPart.click()
  await expect(piece).toHaveClass(/draggable-rod--selected/)

  const before = await p.geometry(piece)
  await p.drag(parts.nth(1), 1, 0)
  await expect.poll(() => p.geometry(piece)).toMatchObject({
    x: before.x + 1,
    y: before.y,
  })
})

test('array can orient a composed train vertically', async ({ playground: p }) => {
  await p.show('Array')

  const first = await p.add('Array', 'three')
  const second = await p.add('Array', 'five')

  await first.click()
  await second.click({ modifiers: ['Shift'] })

  let menu = await p.menu(first)
  await expect(
    menu.getByRole('menuitem', { name: 'Make a train' }),
  ).toBeEnabled()

  await menu.getByRole('menuitem', { name: 'Make a train' }).click()

  const train = p.panel('Array').locator('[data-piece-id]')
  await expect(train).toHaveCount(1)
  await expect(train.locator('.train-part')).toHaveCount(2)

  menu = await p.menu(train.locator('.train-part').first())

  const vertical = menu.getByRole(
    'menuitemcheckbox',
    { name: 'Vertical', exact: true },
  )

  let disabledReason: string | undefined
  if (!(await vertical.isEnabled())) {
    const reason = await vertical.evaluate((element) => {
      const attributes = [
        element.getAttribute('aria-description'),
        element.getAttribute('data-description'),
      ]
      for (const value of attributes) {
        if (value) return value
      }

      const text = element.textContent?.trim()
      return text ? `missing reason attribute, label text: ${text}` : 'missing reason'
    })
    disabledReason = reason
    console.log(`Vertical menu item disabled reason: ${reason}`)
  }

  await expect(vertical, disabledReason).toBeEnabled()
  await vertical.click()

  await expect(train).toHaveCount(1)
  await expect(train.locator('.train-part')).toHaveCount(2)

  await expect.poll(() => p.geometry(train)).toMatchObject({
    width: 1,
    depth: 8,
    height: 1,
  })

  const parts = train.locator('.train-part')
  await expect.poll(() => p.geometry(parts.nth(0))).toMatchObject({
    x: 0,
    y: 0,
  })
  await expect.poll(() => p.geometry(parts.nth(1))).toMatchObject({
    x: 0,
    y: 3,
  })
})

test('array regroups a vertical train into eight ones', async ({
  playground: p,
}) => {
  await p.show('Array')

  const first = await p.add('Array', 'three')
  const second = await p.add('Array', 'five')

  await first.click()
  await second.click({ modifiers: ['Shift'] })

  let menu = await p.menu(first)
  await menu.getByRole('menuitem', {
    name: 'Make a train',
    exact: true,
  }).click()

  const train = p.panel('Array').locator('[data-piece-id]')
  await expect(train).toHaveCount(1)

  menu = await p.menu(train.locator('.train-part').first())
  await menu.getByRole('menuitemcheckbox', {
    name: 'Vertical',
    exact: true,
  }).click()

  await expect.poll(() => p.geometry(train)).toMatchObject({
    width: 1,
    depth: 8,
    height: 1,
  })

  const id = await train.getAttribute('data-piece-id')
  const before = await p.geometry(train)

  menu = await p.menu(train.locator('.train-part').first())

  const regroup = menu.getByRole('menuitem', {
    name: 'Regroup to ones',
    exact: true,
  })

  await expect(regroup).toBeEnabled()
  await regroup.click()

  await expect(train).toHaveCount(1)
  await expect(train).toHaveAttribute('data-piece-id', id!)
  await expect(train).toHaveClass(/draggable-rod--selected/)

  await expect.poll(() => p.geometry(train)).toMatchObject({
    x: before.x,
    y: before.y,
    width: 1,
    depth: 8,
    height: 1,
  })

  const parts = train.locator('.train-part')
  await expect(parts).toHaveCount(8)

  for (let index = 0; index < 8; index++) {
    await expect(parts.nth(index))
      .toHaveAttribute('data-part-value', '1')

    await expect.poll(() => p.geometry(parts.nth(index)))
      .toMatchObject({ x: 0, y: index })
  }
})

test('undoing a regrouped train releases individual ones, and dragging still moves them as one beforehand', async ({
  playground: p,
}) => {
  await p.show('Array')

  const first = await p.add('Array', 'three')
  const second = await p.add('Array', 'five')
  await first.click()
  await second.click({ modifiers: ['Shift'] })

  let menu = await p.menu(first)
  await menu.getByRole('menuitem', {
    name: 'Make a train',
    exact: true,
  }).click()

  const train = p.panel('Array').locator('[data-piece-id]')
  await expect(train).toHaveCount(1)

  menu = await p.menu(train.locator('.train-part').first())
  await menu.getByRole('menuitemcheckbox', {
    name: 'Vertical',
    exact: true,
  }).click()

  await expect.poll(() => p.geometry(train)).toMatchObject({
    width: 1,
    depth: 8,
    height: 1,
  })

  const trainBefore = await p.geometry(train)

  menu = await p.menu(train.locator('.train-part').first())
  await menu.getByRole('menuitem', {
    name: 'Regroup to ones',
    exact: true,
  }).click()

  const parts = train.locator('.train-part')
  await expect(parts).toHaveCount(8)

  await p.drag(parts.first(), 10, 0)

  await expect.poll(() => p.geometry(train)).toMatchObject({
    y: trainBefore.y,
    width: 1,
    depth: 8,
    height: 1,
  })
  await expect.poll(async () => (await p.geometry(train)).x).toBeGreaterThan(
    trainBefore.x,
  )

  menu = await p.menu(parts.first())
  await menu.getByRole('menuitem', {
    name: 'Undo train',
    exact: true,
  }).click()

  const singles = p.panel('Array').locator('[data-piece-id] .train-part')
  await expect(singles).toHaveCount(8)

  for (let index = 0; index < 8; index++) {
    await expect(singles.nth(index))
      .toHaveAttribute('data-part-value', '1')
  }
})

for (const kind of ['Bar', 'Array'] as const) {
  test(`${kind} decomposes a single rod into ones`, async ({
    playground: p,
  }) => {
    await p.show(kind)

    const rod = await p.add(kind, 'five')

    if (kind === 'Array') {
      const orientationMenu = await p.menu(rod)
      await orientationMenu.getByRole('menuitemcheckbox', {
        name: 'Vertical',
        exact: true,
      }).click()
    }

    const before = await p.geometry(rod)
    const id = await rod.getAttribute('data-piece-id')

    const menu = await p.menu(rod)
    const regroup = menu.getByRole('menuitem', {
      name: 'Regroup to ones',
      exact: true,
    })

    await expect(regroup).toBeEnabled()
    await regroup.click()

    await expect(p.panel(kind).locator('[data-piece-id]'))
      .toHaveCount(1)

    await expect(rod).toHaveAttribute('data-piece-id', id!)
    await expect(rod).toHaveClass(/draggable-rod--selected/)

    await expect.poll(() => p.geometry(rod)).toMatchObject({
      x: before.x,
      y: before.y,
      width: before.width,
      depth: before.depth,
      height: before.height,
    })

    const parts = rod.locator('.train-part')
    await expect(parts).toHaveCount(5)

    for (let index = 0; index < 5; index++) {
      await expect(parts.nth(index))
        .toHaveAttribute('data-part-value', '1')

      await expect.poll(() => p.geometry(parts.nth(index)))
        .toMatchObject({
          x: kind === 'Bar' ? index : 0,
          y: kind === 'Array' ? index : 0,
        })
    }
  })
}

test('bar regroups a horizontal train into eight ones', async ({
  playground: p,
}) => {
  await p.show('Bar')

  const first = await p.add('Bar', 'three')
  const second = await p.add('Bar', 'five')

  await first.click()
  await second.click({ modifiers: ['Shift'] })

  let menu = await p.menu(first)
  await menu.getByRole('menuitem', {
    name: 'Make a train',
    exact: true,
  }).click()

  const train = p.panel('Bar').locator('[data-piece-id]')
  await expect(train).toHaveCount(1)

  const id = await train.getAttribute('data-piece-id')
  const before = await p.geometry(train)

  menu = await p.menu(train.locator('.train-part').first())

  const regroup = menu.getByRole('menuitem', {
    name: 'Regroup to ones',
    exact: true,
  })

  await expect(regroup).toBeEnabled()
  await regroup.click()

  await expect(train).toHaveCount(1)
  await expect(train).toHaveAttribute('data-piece-id', id!)
  await expect(train).toHaveClass(/draggable-rod--selected/)

  await expect.poll(() => p.geometry(train)).toMatchObject({
    x: before.x,
    y: before.y,
    width: 8,
    depth: 1,
    height: 1,
  })

  const parts = train.locator('.train-part')
  await expect(parts).toHaveCount(8)

  for (let index = 0; index < 8; index++) {
    await expect(parts.nth(index))
      .toHaveAttribute('data-part-value', '1')

    await expect.poll(() => p.geometry(parts.nth(index)))
      .toMatchObject({ x: index, y: 0 })
  }
})

test('bar clone copies train parts', async ({ playground: p }) => {
  await p.show('Bar')
  const first = await p.add('Bar', 'three')
  const second = await p.add('Bar', 'five')

  await first.click()
  await second.click({ modifiers: ['Shift'] })
  let menu = await p.menu(first)
  await menu.getByRole('menuitem', { name: 'Make a train' }).click()

  const pieces = p.panel('Bar').locator('[data-piece-id]')
  await expect(pieces).toHaveCount(1)
  const built = pieces.first()
  await expect(built.locator('.train-part')).toHaveCount(2)

  menu = await p.menu(built.locator('.train-part').nth(1))
  await menu.getByRole('menuitem', { name: 'Clone' }).click()

  await expect(pieces).toHaveCount(2)
  await expect(pieces.first().locator('.train-part')).toHaveCount(2)
  await expect(pieces.last().locator('.train-part')).toHaveCount(2)
  expect((await p.geometry(pieces.first())).width).toEqual(
    (await p.geometry(pieces.last())).width,
  )
})

test('array menu changes only its rod and persists across tabs', async ({ playground: p }) => {
  await p.show('Array')
  const first = await p.add('Array', 'six')
  const second = await p.add('Array', 'six')
  const before = await p.geometry(first)
  let menu = await p.menu(second, true)
  await menu.getByRole('menuitemcheckbox', { name: 'Vertical', exact: true }).click()
  await expect.poll(() => p.geometry(second)).toMatchObject({ width: 1, depth: 6, height: 1, offset: 0 })
  await expect.poll(() => p.geometry(first)).toEqual(before)
  menu = await p.menu(second)
  await menu.getByRole('menuitemcheckbox', { name: 'Tower', exact: true }).click()
  await expect.poll(() => p.geometry(second)).toMatchObject({ width: 1, depth: 1, height: 6 })
  await p.show('Bar')
  const bar = await p.add('Bar', 'four')
  await p.show('Array')
  await expect(second).toBeVisible()
  await expect.poll(() => p.geometry(second)).toMatchObject({ width: 1, depth: 1, height: 6 })
  await p.show('Bar')
  await expect(bar).toBeVisible()
  await expect(p.panel('Bar').locator('[data-piece-id]')).toHaveCount(1)
})

test('invalid array orientation and drop preserve the accepted geometry', async ({ playground: p }) => {
  await p.show('Array')
  const first = await p.add('Array', 'six')
  await p.add('Array', 'six')
  await p.drag(first, 0, 1)
  await expect.poll(() => p.geometry(first)).toMatchObject({ x: 0, y: 1, offset: 0 })
  const second = p.panel('Array').locator('[data-piece-id]').last()
  await p.drag(second, -6, 0)
  await expect.poll(() => p.geometry(second)).toMatchObject({ x: 0, y: 0, offset: 0 })
  const before = await p.geometry(second)
  const menu = await p.menu(second)
  await expect(menu.getByRole('menuitemcheckbox', { name: /Vertical/i })).toBeDisabled()
  await expect.poll(() => p.geometry(second)).toEqual(before)
  await p.drag(second, 0, 1)
  await expect.poll(() => p.geometry(second)).toEqual(before)
})

test('portrait closes an open menu and preserves both rods', async ({ page, playground: p }) => {
  await p.show('Array')
  const rod = await p.add('Array', 'six')
  await p.add('Array', 'five')
  await p.menu(rod)
  await page.setViewportSize({ width: 412, height: 915 })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect(rod).toHaveAttribute('aria-disabled', 'true')
  await expect(p.panel('Array').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
  await rod.locator('.face.top').click({ button: 'right', force: true })
  await expect(page.getByRole('menu')).toHaveCount(0)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(rod).toHaveAttribute('aria-disabled', 'false')
  await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(2)
  await p.menu(rod, true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('bar portrait hides off-preview rods without deleting them', async ({ page, playground: p }) => {
  const rod = await p.add('Bar', 'six')
  await p.drag(rod, 18, 0)
  await expect.poll(() => p.geometry(rod)).toMatchObject({ x: 18, y: 2, offset: 0 })
  await page.setViewportSize({ width: 412, height: 915 })
  await expect(rod).toBeHidden()
  await expect(p.panel('Bar').locator('[data-piece-id]')).toHaveCount(1)
  await expect(p.panel('Bar').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(rod).toBeVisible()
  await expect.poll(() => p.geometry(rod)).toMatchObject({ x: 18, y: 2, offset: 0 })
})

test('switching tabs during a held group drag cancels movement', async ({ page, playground: p }) => {
  const barTab = page.getByRole('tab', { name: 'Bar Rod Playground', exact: true })
  const arrayTab = page.getByRole('tab', { name: 'Array Rod Playground', exact: true })

  await barTab.click()

  const leader = await p.add('Bar', 'six')
  const follower = await p.add('Bar', 'six')

  await leader.click()
  await follower.click({ modifiers: ['Shift'] })

  await expect(leader).toHaveClass(/--selected/)
  await expect(follower).toHaveClass(/--selected/)

  const leaderBefore = await p.geometry(leader)
  const followerBefore = await p.geometry(follower)

  const face = await leader.locator('.face.top').boundingBox()
  if (!face) throw new Error('Missing leader face')

  await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
  await page.mouse.down()
  await page.mouse.move(face.x + face.width / 2 + 60, face.y + face.height / 2 + 20, { steps: 8 })

  await arrayTab.focus()
  await page.keyboard.press('Enter')

  await page.mouse.up()
  await barTab.click()

  await expect.poll(() => p.geometry(leader)).toMatchObject({
    x: leaderBefore.x,
    y: leaderBefore.y,
    offset: 0,
  })

  await expect.poll(() => p.geometry(follower)).toMatchObject({
    x: followerBefore.x,
    y: followerBefore.y,
    offset: 0,
  })

  await expect(leader).toHaveClass(/--selected/)
  await expect(follower).toHaveClass(/--selected/)

  await p.drag(leader, 1, 0)
  await expect.poll(() => p.geometry(leader)).toMatchObject({
    x: leaderBefore.x + 1,
    y: leaderBefore.y,
    offset: 0,
  })
  await expect.poll(() => p.geometry(follower)).toMatchObject({
    x: followerBefore.x + 1,
    y: followerBefore.y,
    offset: 0,
  })
})

test('array selects each newly created rod', async ({ playground: p }) => {
  await p.show('Array')

  const first = await p.add('Array', 'three')
  await expect(first).toHaveClass(/--selected/)

  const second = await p.add('Array', 'five')
  await expect(second).toHaveClass(/--selected/)
  await expect(first).not.toHaveClass(/--selected/)

  await expect(
    p.panel('Array').getByRole('button', { name: /remove selected rod/i }),
  ).toBeEnabled()
})

test('bar keeps its existing selection when creating a rod', async ({ playground: p }) => {
  await p.show('Bar')

  const first = await p.add('Bar', 'three')
  await expect(first).not.toHaveClass(/--selected/)
  await expect(
    p.panel('Bar').getByRole('button', { name: /remove selected rod/i }),
  ).toBeDisabled()

  await first.click()
  await expect(first).toHaveClass(/--selected/)

  const second = await p.add('Bar', 'five')
  await expect(second).not.toHaveClass(/--selected/)
  await expect(first).toHaveClass(/--selected/)
})

test('scene state and selection stay independent across tabs', async ({ playground: p }) => {
  await p.show('Bar')
  const barFirst = await p.add('Bar', 'three')
  const barSecond = await p.add('Bar', 'five')
  await barFirst.click()
  await barSecond.click({ modifiers: ['Shift'] })
  await expect(barFirst).toHaveClass(/--selected/)
  await expect(barSecond).toHaveClass(/--selected/)

  await p.show('Array')
  await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(0)
  const arrayFirst = await p.add('Array', 'six')
  const arraySecond = await p.add('Array', 'two')
  await expect(arraySecond).toHaveClass(/--selected/)
  await expect(arrayFirst).not.toHaveClass(/--selected/)

  const menu = await p.menu(arraySecond)
  await menu.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(1)

  await p.show('Bar')
  await expect(p.panel('Bar').locator('[data-piece-id]')).toHaveCount(2)
  await expect(barFirst).toHaveClass(/--selected/)
  await expect(barSecond).toHaveClass(/--selected/)

  await p.show('Array')
  await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(1)
  await expect(arrayFirst).not.toHaveClass(/--selected/)
  await expect(
    p.panel('Array').getByRole('button', { name: /remove selected rod/i }),
  ).toBeDisabled()
})

test('returning to a tab preserves committed positions without preview offsets', async ({ playground: p }) => {
  await p.show('Bar')
  const leader = await p.add('Bar', 'six')
  const follower = await p.add('Bar', 'four')

  await leader.click()
  await follower.click({ modifiers: ['Shift'] })

  const leaderOrigin = await p.geometry(leader)
  const followerOrigin = await p.geometry(follower)

  await p.drag(leader, 3, 0)

  await expect.poll(() => p.geometry(leader)).toMatchObject({
    x: leaderOrigin.x + 3,
    y: leaderOrigin.y,
    offset: 0,
  })
  await expect.poll(() => p.geometry(follower)).toMatchObject({
    x: followerOrigin.x + 3,
    y: followerOrigin.y,
    offset: 0,
  })

  const leaderBefore = await p.geometry(leader)
  const followerBefore = await p.geometry(follower)

  await p.show('Array')
  await p.add('Array', 'six')
  await p.show('Bar')

  await expect.poll(() => p.geometry(leader)).toEqual(leaderBefore)
  await expect.poll(() => p.geometry(follower)).toEqual(followerBefore)
  await expect(leader).toHaveClass(/--selected/)
  await expect(follower).toHaveClass(/--selected/)
})

  test.describe('inertia enabled', () => {
    test.use({
      contextOptions: {
        reducedMotion: 'no-preference',
      },
      reducedMotion: 'no-preference',
    })

  test('a throw clamps to the board edge during drag and after release', async ({ page, playground: p }) => {
    const columns = 24

    const rod = await p.add('Bar', 'six')
    await p.drag(rod, 18, 0)
    const anchored = await p.geometry(rod)
    const clampX = columns - anchored.width

    const face = await rod.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing rod face')

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      face.x + face.width / 2 + 180,
      face.y + face.height / 2 + 10,
      { steps: 8 },
    )

    await expect
      .poll(async () => {
        const geometry = await p.geometry(rod)
        return geometry.x + geometry.width <= columns
      })
      .toBe(true)

    await page.mouse.up()

    await expect.poll(() => p.geometry(rod)).toMatchObject({
      x: clampX,
      y: anchored.y,
      offset: 0,
    })

    const firstMenu = await p.menu(rod)
    await firstMenu.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(rod).toHaveCount(0)

  })

  test('a two-train throw clamps by the furthest-right part', async ({ playground: p }) => {
    const columns = 24

    const leader = await p.add('Bar', 'six')
    const follower = await p.add('Bar', 'three')

    const leaderOrigin = await p.geometry(leader)
    const followerOrigin = await p.geometry(follower)
    const rightmostEdge = Math.max(
      leaderOrigin.x + leaderOrigin.width,
      followerOrigin.x + followerOrigin.width,
    )
    const constrainedDelta = columns - rightmostEdge
    const leaderFinal = leaderOrigin.x + constrainedDelta
    const followerFinal = followerOrigin.x + constrainedDelta

    await leader.click()
    await follower.click({ modifiers: ['Shift'] })
    await p.drag(leader, 20, 0)

    await expect.poll(() => p.geometry(leader)).toMatchObject({
      x: leaderFinal,
      y: leaderOrigin.y,
      offset: 0,
    })
    await expect.poll(() => p.geometry(follower)).toMatchObject({
      x: followerFinal,
      y: followerOrigin.y,
      offset: 0,
    })
  })

  test('switching tabs during group inertia cancels movement', async ({ page, playground: p }) => {
    const barTab = page.getByRole('tab', { name: 'Bar Rod Playground', exact: true })
    const arrayTab = page.getByRole('tab', { name: 'Array Rod Playground', exact: true })

    await barTab.click()

    const leader = await p.add('Bar', 'six')
    const follower = await p.add('Bar', 'six')

    await leader.click()
    await follower.click({ modifiers: ['Shift'] })

    const leaderBefore = await p.geometry(leader)
    const followerBefore = await p.geometry(follower)

    const face = await leader.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing leader face')
    const throwAxes = await leader.evaluate(el => {
      const world = el.closest('[data-grid-world]')!
      const rect = (name: string) =>
        world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const origin = rect('origin')
      const x = rect('x')
      return { xx: x.left - origin.left, xy: x.top - origin.top }
    })

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      face.x + face.width / 2 + throwAxes.xx * 10,
      face.y + face.height / 2 + throwAxes.xy * 10,
      { steps: 8 },
    )
    await page.mouse.up()

    await expect.poll(async () => (await p.geometry(leader)).offset).toBeGreaterThan(0.05)
    await arrayTab.focus()
    await page.keyboard.press('Enter')
    await barTab.click()

    await expect.poll(() => p.geometry(leader)).toMatchObject({
      x: leaderBefore.x,
      y: leaderBefore.y,
      offset: 0,
    })
    await expect.poll(() => p.geometry(follower)).toMatchObject({
      x: followerBefore.x,
      y: followerBefore.y,
      offset: 0,
    })
    await expect(leader).toHaveClass(/--selected/)
    await expect(follower).toHaveClass(/--selected/)
  })

  test('pointer-down on a tab during group inertia cancels movement before release', async ({ page, playground: p }) => {
    const barTab = page.getByRole('tab', { name: 'Bar Rod Playground', exact: true })
    const arrayTab = page.getByRole('tab', { name: 'Array Rod Playground', exact: true })

    await barTab.click()

    const leader = await p.add('Bar', 'six')
    const follower = await p.add('Bar', 'six')

    await leader.click()
    await follower.click({ modifiers: ['Shift'] })

    const leaderBefore = await p.geometry(leader)
    const followerBefore = await p.geometry(follower)

    const face = await leader.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing leader face')
    const throwAxes = await leader.evaluate(el => {
      const world = el.closest('[data-grid-world]')!
      const rect = (name: string) =>
        world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const origin = rect('origin')
      const x = rect('x')
      return { xx: x.left - origin.left, xy: x.top - origin.top }
    })

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      face.x + face.width / 2 + throwAxes.xx * 10,
      face.y + face.height / 2 + throwAxes.xy * 10,
      { steps: 8 },
    )
    await page.mouse.up()

    await expect.poll(async () => (await p.geometry(leader)).offset).toBeGreaterThan(0.05)

    const tab = await arrayTab.boundingBox()
    if (!tab) throw new Error('Missing array tab')

    // The tab activates on pointer-down and hides the Bar panel, which
    // role-scoped locators then exclude. Read the held rods by id instead.
    const hiddenBar = page.getByRole('tabpanel', {
      name: 'Bar Rod Playground',
      exact: true,
      includeHidden: true,
    })
    const leaderId = await leader.getAttribute('data-piece-id')
    const followerId = await follower.getAttribute('data-piece-id')
    const heldLeader = hiddenBar.locator(`[data-piece-id="${leaderId}"]`)
    const heldFollower = hiddenBar.locator(`[data-piece-id="${followerId}"]`)

    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2)
    await page.mouse.down()

    // The pointer is still held on the tab: movement is already cancelled.
    await expect.poll(() => p.geometry(heldLeader)).toMatchObject({
      x: leaderBefore.x,
      y: leaderBefore.y,
      offset: 0,
    })
    await expect.poll(() => p.geometry(heldFollower)).toMatchObject({
      x: followerBefore.x,
      y: followerBefore.y,
      offset: 0,
    })

    await page.mouse.up()
    await expect(arrayTab).toHaveAttribute('aria-selected', 'true')
    await barTab.click()

    await expect.poll(() => p.geometry(leader)).toMatchObject({
      x: leaderBefore.x,
      y: leaderBefore.y,
      offset: 0,
    })
    await expect.poll(() => p.geometry(follower)).toMatchObject({
      x: followerBefore.x,
      y: followerBefore.y,
      offset: 0,
    })
    await expect(leader).toHaveClass(/--selected/)
    await expect(follower).toHaveClass(/--selected/)
  })

  test('keyboard tab activation during inertia cancels movement', async ({ page, playground: p }) => {
    const barTab = page.getByRole('tab', { name: 'Bar Rod Playground', exact: true })
    const arrayTab = page.getByRole('tab', { name: 'Array Rod Playground', exact: true })

    await barTab.click()

    const leader = await p.add('Bar', 'six')
    const follower = await p.add('Bar', 'six')

    await leader.click()
    await follower.click({ modifiers: ['Shift'] })

    const leaderBefore = await p.geometry(leader)
    const followerBefore = await p.geometry(follower)

    const face = await leader.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing leader face')
    const throwAxes = await leader.evaluate(el => {
      const world = el.closest('[data-grid-world]')!
      const rect = (name: string) =>
        world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
      const origin = rect('origin')
      const x = rect('x')
      return { xx: x.left - origin.left, xy: x.top - origin.top }
    })

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      face.x + face.width / 2 + throwAxes.xx * 10,
      face.y + face.height / 2 + throwAxes.xy * 10,
      { steps: 8 },
    )
    await page.mouse.up()

    await expect.poll(async () => (await p.geometry(leader)).offset).toBeGreaterThan(0.05)

    await arrayTab.focus()
    await page.keyboard.press('Enter')
    if ((await arrayTab.getAttribute('aria-selected')) !== 'true') {
      await page.keyboard.press('ArrowRight')
    }
    await barTab.click()

    await expect.poll(() => p.geometry(leader)).toMatchObject({
      x: leaderBefore.x,
      y: leaderBefore.y,
      offset: 0,
    })
    await expect.poll(() => p.geometry(follower)).toMatchObject({
      x: followerBefore.x,
      y: followerBefore.y,
      offset: 0,
    })
    await expect(leader).toHaveClass(/--selected/)
    await expect(follower).toHaveClass(/--selected/)
  })
})

const pairLabels = ['1 + 4', '2 + 3', '3 + 2', '4 + 1'] as const

async function decomposeThroughAddendPairs(
  p: Playground,
  method: 'mouse' | 'keyboard' | 'touch',
) {
  await p.show('Bar')

  for (const label of pairLabels) {
    const firstAddend = Number(label.split(' + ')[0])
    const secondAddend = 5 - firstAddend

    const rod = await p.add('Bar', 'five')
    const id = await rod.getAttribute('data-piece-id')
    const before = await p.geometry(rod)

    const menu = method === 'touch'
      ? await p.menuByTouch(rod)
      : await p.menu(rod, method === 'keyboard')

    const parent = menu.getByRole('menuitem', { name: 'Regroup to addends' })

    if (method === 'mouse') {
      await parent.hover()
    } else if (method === 'keyboard') {
      await parent.focus()
      await parent.press('ArrowRight')
    } else {
      await parent.tap()
    }

    const pairItem = menu.getByRole('menuitem', { name: label, exact: true })
    await expect(pairItem).toBeVisible()

    if (method === 'touch') {
      await pairItem.tap()
    } else {
      await pairItem.click()
    }

    const pieces = p.panel('Bar').locator('[data-piece-id]')
    await expect(pieces).toHaveCount(1)
    await expect(rod).toHaveAttribute('data-piece-id', id!)
    await expect(rod).toHaveClass(/draggable-rod--selected/)

    await expect.poll(() => p.geometry(rod)).toMatchObject({
      x: before.x,
      y: before.y,
      width: before.width,
      depth: before.depth,
      height: before.height,
    })

    const parts = rod.locator('.train-part')
    await expect(parts).toHaveCount(2)
    await expect(parts.nth(0)).toHaveAttribute('data-part-value', String(firstAddend))
    await expect(parts.nth(1)).toHaveAttribute('data-part-value', String(secondAddend))

    await expect.poll(() => p.geometry(parts.nth(0))).toMatchObject({ x: 0, y: 0 })
    await expect.poll(() => p.geometry(parts.nth(1))).toMatchObject({ x: firstAddend, y: 0 })

    const cleanupMenu = await p.menu(parts.first())
    await cleanupMenu.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(pieces).toHaveCount(0)
  }
}

test.describe('addend decomposition submenu', () => {
  test('bar decomposes a 5-rod through each addend pair using mouse', async ({ playground: p }) => {
    await decomposeThroughAddendPairs(p, 'mouse')
  })

  test('bar decomposes a 5-rod through each addend pair using keyboard', async ({ playground: p }) => {
    await decomposeThroughAddendPairs(p, 'keyboard')
  })

  test('opening and dismissing the addend submenu performs no decomposition', async ({
    page,
    playground: p,
  }) => {
    await p.show('Bar')
    const rod = await p.add('Bar', 'five')
    const id = await rod.getAttribute('data-piece-id')
    const before = await p.geometry(rod)

    const menu = await p.menu(rod)
    const parent = menu.getByRole('menuitem', { name: 'Regroup to addends' })
    await parent.hover()
    await expect(menu.getByRole('menuitem', { name: '1 + 4', exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)

    await expect(rod).toHaveAttribute('data-piece-id', id!)
    await expect(rod.locator('.train-part')).toHaveCount(1)
    await expect.poll(() => p.geometry(rod)).toEqual(before)
  })
})

test.describe('addend decomposition submenu (touch)', () => {
  test.use({ contextOptions: { hasTouch: true } })

  test('bar decomposes a 5-rod through each addend pair using touch', async ({ playground: p }) => {
    await decomposeThroughAddendPairs(p, 'touch')
  })
})

test('array changes a six-rod between ordered factor rectangles', async ({
  page,
  playground: p,
}) => {
  await p.show('Array')

  const rod = await p.add('Array', 'six')
  const id = await rod.getAttribute('data-piece-id')
  const before = await p.geometry(rod)

  async function chooseFactors(label: string) {
    // Target one part: rectangles contain multiple .face.top elements.
    const menu = await p.menu(rod.locator('.train-part').first())

    const submenu = menu.getByRole('menuitem', {
      name: 'Regroup to factors',
      exact: true,
    })

    await expect(submenu).toBeEnabled()
    await submenu.hover()

    await page.getByRole('menuitem', {
      name: label,
      exact: true,
    }).click()

    await expect(page.getByRole('menu')).toHaveCount(0)
  }

  for (const shape of [
    { rows: 2, columns: 3 },
    { rows: 3, columns: 2 },
  ]) {
    await chooseFactors(`${shape.rows} rows of ${shape.columns}`)

    await expect(p.panel('Array').locator('[data-piece-id]'))
      .toHaveCount(1)

    await expect(rod).toHaveAttribute('data-piece-id', id!)
    await expect(rod).toHaveClass(/draggable-rod--selected/)

    await expect.poll(() => p.geometry(rod)).toMatchObject({
      x: before.x,
      y: before.y,
      width: shape.columns,
      depth: shape.rows,
      height: 1,
    })

    const parts = rod.locator('.train-part')
    await expect(parts).toHaveCount(shape.rows)

    for (let row = 0; row < shape.rows; row++) {
      await expect(parts.nth(row)).toHaveAttribute(
        'data-part-value',
        String(shape.columns),
      )

      await expect.poll(async () => {
        const geometry = await p.geometry(parts.nth(row))
        return { x: geometry.x, y: geometry.y }
      }).toEqual({ x: 0, y: row })
    }
  }
})

const factorLabels = ['2 rows of 3', '3 rows of 2'] as const

async function changeFactorsThroughShapes(
  p: Playground,
  method: 'keyboard' | 'touch',
) {
  await p.show('Array')

  const rod = await p.add('Array', 'six')
  const id = await rod.getAttribute('data-piece-id')
  const before = await p.geometry(rod)

  for (const label of factorLabels) {
    const rows = Number(label.split(' rows of ')[0])
    const columns = 6 / rows

    // Rectangles contain several .face.top elements, so touch targets one part.
    const menu = method === 'touch'
      ? await p.menuByTouch(rod.locator('.train-part').first())
      : await p.menu(rod, true)

    const parent = menu.getByRole('menuitem', {
      name: 'Regroup to factors',
      exact: true,
    })
    await expect(parent).toBeEnabled()

    if (method === 'keyboard') {
      await parent.focus()
      await parent.press('ArrowRight')
    } else {
      await parent.tap()
    }

    const shapeItem = menu.getByRole('menuitem', { name: label, exact: true })
    await expect(shapeItem).toBeVisible()

    if (method === 'touch') {
      await shapeItem.tap()
    } else {
      await shapeItem.press('Enter')
    }

    await expect(p.page.getByRole('menu')).toHaveCount(0)

    await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(1)
    await expect(rod).toHaveAttribute('data-piece-id', id!)
    await expect(rod).toHaveClass(/draggable-rod--selected/)

    await expect.poll(() => p.geometry(rod)).toMatchObject({
      x: before.x,
      y: before.y,
      width: columns,
      depth: rows,
      height: 1,
    })

    const parts = rod.locator('.train-part')
    await expect(parts).toHaveCount(rows)

    for (let row = 0; row < rows; row++) {
      await expect(parts.nth(row)).toHaveAttribute('data-part-value', String(columns))
      await expect.poll(async () => {
        const geometry = await p.geometry(parts.nth(row))
        return { x: geometry.x, y: geometry.y }
      }).toEqual({ x: 0, y: row })
    }
  }
}

test.describe('factor rectangle submenu', () => {
  test('array changes a six-rod between factor rectangles using keyboard', async ({
    playground: p,
  }) => {
    await changeFactorsThroughShapes(p, 'keyboard')
  })

  test('array enables the factor submenu while disabling a blocked default child', async ({
    page,
    playground: p,
  }) => {
    await p.show('Array')

    const six = await p.add('Array', 'six') // (0, 0)
    const obstacle = await p.add('Array', 'one') // (6, 0)
    const obstacleBefore = await p.geometry(obstacle)

    // Park the one-rod at (2, 1): inside "2 rows of 3", outside "3 rows of 2".
    await p.drag(obstacle, -4, 1)
    await expect.poll(() => p.geometry(obstacle)).toMatchObject({
      x: obstacleBefore.x - 4,
      y: obstacleBefore.y + 1,
    })

    const id = await six.getAttribute('data-piece-id')
    const before = await p.geometry(six)

    const menu = await p.menu(six)
    const parent = menu.getByRole('menuitem', {
      name: 'Regroup to factors',
      exact: true,
    })
    await expect(parent).toBeEnabled()
    await parent.hover()

    // A disabled item's accessible name also carries its reason.
    const blocked = page.getByRole('menuitem', { name: /^2 rows of 3/ })
    const open = page.getByRole('menuitem', { name: '3 rows of 2', exact: true })

    await expect(blocked).toBeVisible()
    await expect(blocked).toBeDisabled()
    await expect(blocked).toHaveAccessibleName(/overlaps another part/)
    await expect(open).toBeEnabled()

    await open.click()
    await expect(page.getByRole('menu')).toHaveCount(0)

    await expect(p.panel('Array').locator('[data-piece-id]')).toHaveCount(2)
    await expect(six).toHaveAttribute('data-piece-id', id!)
    await expect(six.locator('.train-part')).toHaveCount(3)

    await expect.poll(() => p.geometry(six)).toMatchObject({
      x: before.x,
      y: before.y,
      width: 2,
      depth: 3,
      height: 1,
    })

    await expect.poll(() => p.geometry(obstacle)).toMatchObject({
      x: obstacleBefore.x - 4,
      y: obstacleBefore.y + 1,
    })
  })

  test('bar menu offers no factor entry', async ({ playground: p }) => {
    await p.show('Bar')
    const rod = await p.add('Bar', 'six')
    const menu = await p.menu(rod)

    await expect(menu.getByRole('menuitem', { name: 'Regroup to factors' })).toHaveCount(0)
    await expect(menu.getByRole('menuitem')).toHaveCount(6)
  })
})

test.describe('factor rectangle submenu (touch)', () => {
  test.use({ contextOptions: { hasTouch: true } })

  test('array changes a six-rod between factor rectangles using touch', async ({
    playground: p,
  }) => {
    await changeFactorsThroughShapes(p, 'touch')
  })
})

test('array factor rectangle drags, clamps, clones, and undoes as one piece', async ({
  playground: p,
}) => {
  const columns = 24

  await p.show('Array')

  const rod = await p.add('Array', 'six')
  const id = await rod.getAttribute('data-piece-id')

  let menu = await p.menu(rod)
  await menu.getByRole('menuitem', {
    name: 'Regroup to factors',
    exact: true,
  }).hover()
  await p.page.getByRole('menuitem', {
    name: '2 rows of 3',
    exact: true,
  }).click()
  await expect(p.page.getByRole('menu')).toHaveCount(0)

  const rectangle = { width: 3, depth: 2, height: 1 }
  const start = await p.geometry(rod)
  expect(start).toMatchObject(rectangle)

  const parts = rod.locator('.train-part')
  await expect(parts).toHaveCount(2)

  // Dragging one part moves the whole rectangle and keeps its rows.
  await p.drag(parts.first(), 4, 3)

  await expect.poll(() => p.geometry(rod)).toMatchObject({
    ...rectangle,
    x: start.x + 4,
    y: start.y + 3,
    offset: 0,
  })
  await expect(rod).toHaveAttribute('data-piece-id', id!)
  await expect(parts).toHaveCount(2)

  for (let row = 0; row < 2; row++) {
    await expect(parts.nth(row)).toHaveAttribute('data-part-value', '3')
    await expect.poll(async () => {
      const geometry = await p.geometry(parts.nth(row))
      return { x: geometry.x, y: geometry.y }
    }).toEqual({ x: 0, y: row })
  }

  // A drag past the right edge clamps by the rectangle's full width.
  await p.drag(parts.last(), columns, 0)

  await expect.poll(() => p.geometry(rod)).toMatchObject({
    ...rectangle,
    x: columns - rectangle.width,
    y: start.y + 3,
    offset: 0,
  })

  // Clone copies both rows with the same footprint.
  const pieces = p.panel('Array').locator('[data-piece-id]')
  menu = await p.menu(parts.first())
  await menu.getByRole('menuitem', { name: 'Clone', exact: true }).click()

  await expect(pieces).toHaveCount(2)
  await expect(pieces.first().locator('.train-part')).toHaveCount(2)
  await expect(pieces.last().locator('.train-part')).toHaveCount(2)
  expect(await p.geometry(pieces.last())).toMatchObject(rectangle)

  // Undo train releases each row of the original as its own three-rod.
  menu = await p.menu(rod.locator('.train-part').first())
  await menu.getByRole('menuitem', { name: 'Undo train', exact: true }).click()

  await expect(pieces).toHaveCount(3)

  const threes = p.panel('Array').locator('[data-piece-id] .train-part')
  await expect(threes).toHaveCount(4)

  for (let index = 0; index < 4; index++) {
    await expect(threes.nth(index)).toHaveAttribute('data-part-value', '3')
  }
})

test.describe('marquee selection', () => {
  type Box = { x: number, y: number, width: number, depth: number }

  /** A sweep from the empty row below the rods up across all of them. */
  function sweep(boxes: Box[]) {
    const left = Math.min(...boxes.map(box => box.x))
    const right = Math.max(...boxes.map(box => box.x + box.width))
    const top = Math.min(...boxes.map(box => box.y))
    const bottom = Math.max(...boxes.map(box => box.y + box.depth))

    return {
      from: { x: left + 0.25, y: bottom + 0.5 },
      to: { x: right - 0.25, y: top + 0.5 },
      empty: { x: left + 0.25, y: bottom + 0.5 },
    }
  }

  test('bar marquee previews, commits, and a plain empty click clears', async ({ playground: p }) => {
    const first = await p.add('Bar', 'six')
    const second = await p.add('Bar', 'three')
    await expect(first).not.toHaveClass(/--selected/)

    const a = await p.geometry(first)
    const b = await p.geometry(second)
    const { from, to, empty } = sweep([a, b])
    const overlay = p.panel('Bar').locator('[data-scene-marquee]')

    await p.marquee('Bar', from, to, {
      beforeRelease: async () => {
        await expect(overlay).toBeVisible()
        await expect(first).toHaveClass(/--selected/)
        await expect(second).toHaveClass(/--selected/)
        await expect(p.panel('Bar').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
      },
    })

    await expect(overlay).toHaveCount(0)
    await expect(first).toHaveClass(/--selected/)
    await expect(second).toHaveClass(/--selected/)
    await expect(p.panel('Bar').getByRole('button', { name: /remove selected rod/i })).toBeEnabled()

    // The drag selected without moving anything.
    await expect.poll(() => p.geometry(first)).toMatchObject({ x: a.x, y: a.y, offset: 0 })
    await expect.poll(() => p.geometry(second)).toMatchObject({ x: b.x, y: b.y, offset: 0 })

    const spot = await p.boardClient('Bar', empty)
    await p.page.mouse.click(spot.x, spot.y)
    await expect(first).not.toHaveClass(/--selected/)
    await expect(second).not.toHaveClass(/--selected/)

    // A shift-click on empty board keeps the selection instead.
    await first.click()
    await p.page.keyboard.down('Shift')
    await p.page.mouse.click(spot.x, spot.y)
    await p.page.keyboard.up('Shift')
    await expect(first).toHaveClass(/--selected/)
  })

  test('array marquee follows the tilted board', async ({ playground: p }) => {
    await p.show('Array')
    const first = await p.add('Array', 'four')
    const second = await p.add('Array', 'two')

    const a = await p.geometry(first)
    const b = await p.geometry(second)
    const { from, to } = sweep([a, b])
    const overlay = p.panel('Array').locator('[data-scene-marquee]')

    await p.marquee('Array', from, to, {
      beforeRelease: async () => {
        await expect(overlay).toBeVisible()

        // The overlay lives in board space, so on screen it is foreshortened
        // by the tilt and overlaps each rod's ground footprint.
        const box = await overlay.boundingBox()
        if (!box) throw new Error('Missing marquee box')

        const cell = await p.panel('Array').locator('[data-grid-world]').first()
          .evaluate(world => parseFloat(getComputedStyle(world).getPropertyValue('--cell-size')))
        const tilt = 15 * Math.PI / 180
        expect(box.width).toBeCloseTo((to.x - from.x) * cell, 0)
        expect(box.height).toBeCloseTo((from.y - to.y) * cell * Math.cos(tilt), 0)

        for (const rod of [first, second]) {
          const footprint = await rod.boundingBox()
          if (!footprint) throw new Error('Missing rod footprint')
          const overlapX = Math.min(box.x + box.width, footprint.x + footprint.width)
            - Math.max(box.x, footprint.x)
          const overlapY = Math.min(box.y + box.height, footprint.y + footprint.height)
            - Math.max(box.y, footprint.y)
          expect(overlapX).toBeGreaterThan(cell / 4)
          expect(overlapY).toBeGreaterThan(cell / 4)
        }

        await expect(first).toHaveClass(/--selected/)
        await expect(second).toHaveClass(/--selected/)
      },
    })

    await expect(overlay).toHaveCount(0)
    await expect(first).toHaveClass(/--selected/)
    await expect(second).toHaveClass(/--selected/)
    await expect.poll(() => p.geometry(first)).toMatchObject({ x: a.x, y: a.y, offset: 0 })
    await expect.poll(() => p.geometry(second)).toMatchObject({ x: b.x, y: b.y, offset: 0 })

    // Control-drag over one rod toggles it out of the committed selection.
    await p.marquee('Array', sweep([a]).from, sweep([a]).to, { modifiers: ['Control'] })
    await expect(first).not.toHaveClass(/--selected/)
    await expect(second).toHaveClass(/--selected/)
  })

  test('escape during a bar marquee keeps the committed selection', async ({ page, playground: p }) => {
    const first = await p.add('Bar', 'six')
    const second = await p.add('Bar', 'three')
    await second.click()
    await expect(second).toHaveClass(/--selected/)

    const { from, to } = sweep([await p.geometry(first)])
    const overlay = p.panel('Bar').locator('[data-scene-marquee]')

    await p.marquee('Bar', from, to, {
      beforeRelease: async () => {
        await expect(overlay).toBeVisible()
        await expect(first).toHaveClass(/--selected/)
        await expect(second).not.toHaveClass(/--selected/)

        await page.keyboard.press('Escape')

        await expect(overlay).toHaveCount(0)
        await expect(first).not.toHaveClass(/--selected/)
        await expect(second).toHaveClass(/--selected/)
      },
    })

    await expect(first).not.toHaveClass(/--selected/)
    await expect(second).toHaveClass(/--selected/)
  })

  test('switching tabs during a marquee discards its preview', async ({ page, playground: p }) => {
    const barTab = page.getByRole('tab', { name: 'Bar Rod Playground', exact: true })
    const arrayTab = page.getByRole('tab', { name: 'Array Rod Playground', exact: true })

    const first = await p.add('Bar', 'six')
    const { from, to } = sweep([await p.geometry(first)])

    await p.marquee('Bar', from, to, {
      beforeRelease: async () => {
        await expect(first).toHaveClass(/--selected/)
        await arrayTab.focus()
        await page.keyboard.press('Enter')
      },
    })

    await barTab.click()
    await expect(first).not.toHaveClass(/--selected/)
    await expect(p.panel('Bar').locator('[data-scene-marquee]')).toHaveCount(0)
  })
})

test.describe('marquee gestures', () => {
  type Box = { x: number, y: number, width: number, depth: number }

  /** Board points for a sweep from the empty row below the rods up across them. */
  function sweep(boxes: Box[]) {
    const left = Math.min(...boxes.map(box => box.x))
    const right = Math.max(...boxes.map(box => box.x + box.width))
    const top = Math.min(...boxes.map(box => box.y))
    const bottom = Math.max(...boxes.map(box => box.y + box.depth))

    return {
      from: { x: left + 0.25, y: bottom + 0.5 },
      to: { x: right - 0.25, y: top + 0.5 },
      empty: { x: left + 0.25, y: bottom + 0.5 },
    }
  }

  test('shift-drag adds hits while keeping the original selection', async ({ playground: p }) => {
    const first = await p.add('Bar', 'six')
    const second = await p.add('Bar', 'three')
    const third = await p.add('Bar', 'two')

    await first.click()
    await expect(first).toHaveClass(/--selected/)
    await expect(second).not.toHaveClass(/--selected/)

    const { from, to } = sweep([await p.geometry(third)])

    await p.marquee('Bar', from, to, {
      modifiers: ['Shift'],
      beforeRelease: async () => {
        await expect(first).toHaveClass(/--selected/)
        await expect(second).not.toHaveClass(/--selected/)
        await expect(third).toHaveClass(/--selected/)
      },
    })

    await expect(first).toHaveClass(/--selected/)
    await expect(second).not.toHaveClass(/--selected/)
    await expect(third).toHaveClass(/--selected/)
  })

  for (const modifier of ['Control', 'Meta'] as const) {
    test(`${modifier}-drag toggles against the starting selection while leaving and re-entering`, async ({ page, playground: p }) => {
      const first = await p.add('Bar', 'six')
      const second = await p.add('Bar', 'three')
      const third = await p.add('Bar', 'two')

      await first.click()
      await second.click({ modifiers: ['Shift'] })
      await expect(first).toHaveClass(/--selected/)
      await expect(second).toHaveClass(/--selected/)
      await expect(third).not.toHaveClass(/--selected/)

      const b = await p.geometry(second)
      const c = await p.geometry(third)
      const bottom = b.y + b.depth
      const at = (point: { x: number, y: number }) => p.boardClient('Bar', point)

      const start = await at({ x: b.x + 0.25, y: bottom + 0.5 })
      const insideB = await at({ x: b.x + 0.75, y: b.y + 0.5 })
      const belowB = await at({ x: b.x + 0.75, y: bottom + 0.25 })
      const acrossBC = await at({ x: c.x + 0.5, y: c.y + 0.5 })
      const belowC = await at({ x: c.x + 0.5, y: bottom + 0.25 })
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')

      await page.keyboard.down(modifier)
      try {
        await page.mouse.move(start.x, start.y)
        await page.mouse.down()

        // Enter the second rod: toggled out of the starting selection.
        await page.mouse.move(insideB.x, insideB.y, { steps: 6 })
        await expect(overlay).toBeVisible()
        await expect(second).not.toHaveClass(/--selected/)
        await expect(first).toHaveClass(/--selected/)

        // Leave it: the preview re-derives from the starting selection.
        await page.mouse.move(belowB.x, belowB.y, { steps: 6 })
        await expect(second).toHaveClass(/--selected/)
        await expect(first).toHaveClass(/--selected/)

        // Re-enter, now reaching the third rod too.
        await page.mouse.move(acrossBC.x, acrossBC.y, { steps: 6 })
        await expect(second).not.toHaveClass(/--selected/)
        await expect(third).toHaveClass(/--selected/)
        await expect(first).toHaveClass(/--selected/)

        // Leave both again: back to the starting selection.
        await page.mouse.move(belowC.x, belowC.y, { steps: 6 })
        await expect(second).toHaveClass(/--selected/)
        await expect(third).not.toHaveClass(/--selected/)

        // Re-enter both for the final release.
        await page.mouse.move(acrossBC.x, acrossBC.y, { steps: 6 })
        await expect(second).not.toHaveClass(/--selected/)
        await expect(third).toHaveClass(/--selected/)
      } finally {
        await page.mouse.up()
        await page.keyboard.up(modifier)
      }

      await expect(overlay).toHaveCount(0)
      await expect(first).toHaveClass(/--selected/)
      await expect(second).not.toHaveClass(/--selected/)
      await expect(third).toHaveClass(/--selected/)
    })
  }

  test('array empty clicks: plain clears, modified preserves', async ({ page, playground: p }) => {
    await p.show('Array')
    const first = await p.add('Array', 'four')
    const second = await p.add('Array', 'two')

    const { from, to, empty } = sweep([await p.geometry(first), await p.geometry(second)])
    await p.marquee('Array', from, to)
    await expect(first).toHaveClass(/--selected/)
    await expect(second).toHaveClass(/--selected/)

    const spot = await p.boardClient('Array', empty)

    for (const modifier of ['Shift', 'Control', 'Meta'] as const) {
      await page.keyboard.down(modifier)
      await page.mouse.click(spot.x, spot.y)
      await page.keyboard.up(modifier)
      await expect(first).toHaveClass(/--selected/)
      await expect(second).toHaveClass(/--selected/)
    }

    await page.mouse.click(spot.x, spot.y)
    await expect(first).not.toHaveClass(/--selected/)
    await expect(second).not.toHaveClass(/--selected/)
    await expect(p.panel('Array').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
  })

  test.describe('inertia enabled', () => {
    test.use({
      contextOptions: { reducedMotion: 'no-preference' },
      reducedMotion: 'no-preference',
    })

    test('starting a marquee during a throw cancels movement and selects stationary footprints', async ({ page, playground: p }) => {
      const thrown = await p.add('Bar', 'six')
      const other = await p.add('Bar', 'three')

      const a = await p.geometry(thrown)
      const b = await p.geometry(other)

      const face = await thrown.locator('.face.top').boundingBox()
      if (!face) throw new Error('Missing rod face')
      const axes = await thrown.evaluate(el => {
        const world = el.closest('[data-grid-world]')!
        const rect = (name: string) =>
          world.querySelector(`[data-grid-axis="${name}"]`)!.getBoundingClientRect()
        const origin = rect('origin')
        const x = rect('x')
        return { xx: x.left - origin.left, xy: x.top - origin.top }
      })

      await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
      await page.mouse.down()
      await page.mouse.move(
        face.x + face.width / 2 + axes.xx * 10,
        face.y + face.height / 2 + axes.xy * 10,
        { steps: 8 },
      )
      await page.mouse.up()

      await expect.poll(async () => (await p.geometry(thrown)).offset).toBeGreaterThan(0.05)

      // Press on empty board below the committed footprints while the throw coasts.
      const { from, to } = sweep([a, b])
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')

      await p.marquee('Bar', from, to, {
        beforeRelease: async () => {
          await expect(overlay).toBeVisible()
          // Movement was cancelled first: the rod sits on its committed anchor.
          await expect.poll(() => p.geometry(thrown)).toMatchObject({ x: a.x, y: a.y, offset: 0 })
          await expect(thrown).toHaveClass(/--selected/)
          await expect(other).toHaveClass(/--selected/)
        },
      })

      await expect(overlay).toHaveCount(0)
      await expect(thrown).toHaveClass(/--selected/)
      await expect(other).toHaveClass(/--selected/)
      await expect.poll(() => p.geometry(thrown)).toMatchObject({ x: a.x, y: a.y, offset: 0 })
      await expect.poll(() => p.geometry(other)).toMatchObject({ x: b.x, y: b.y, offset: 0 })
    })
  })

  test.describe('touch', () => {
    // Replacing contextOptions drops the config's reducedMotion, so restate it.
    test.use({ contextOptions: { hasTouch: true, reducedMotion: 'reduce' } })

    /** Client delta that moves a rod by `cells` columns on this board. */
    async function columnDelta(p: Playground, cells: number) {
      const origin = await p.boardClient('Bar', { x: 0, y: 0 })
      const shifted = await p.boardClient('Bar', { x: cells, y: 0 })
      return { x: shifted.x - origin.x, y: shifted.y - origin.y }
    }

    async function faceCenter(rod: Locator) {
      const face = await rod.locator('.face.top').boundingBox()
      if (!face) throw new Error('Missing rod face')
      return { x: face.x + face.width / 2, y: face.y + face.height / 2 }
    }

    test('touch drag on empty board selects crossed rods without moving them', async ({ playground: p }) => {
      const first = await p.add('Bar', 'six')
      const second = await p.add('Bar', 'three')
      const a = await p.geometry(first)
      const b = await p.geometry(second)
      const { from, to } = sweep([a, b])
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')

      await p.touch.down(1, await p.boardClient('Bar', from))
      await p.touch.move(1, await p.boardClient('Bar', to))

      await expect(overlay).toBeVisible()
      await expect(first).toHaveClass(/--selected/)
      await expect(second).toHaveClass(/--selected/)

      await p.touch.up(1)

      await expect(overlay).toHaveCount(0)
      await expect(first).toHaveClass(/--selected/)
      await expect(second).toHaveClass(/--selected/)
      await expect.poll(() => p.geometry(first)).toMatchObject({ x: a.x, y: a.y, offset: 0 })
      await expect.poll(() => p.geometry(second)).toMatchObject({ x: b.x, y: b.y, offset: 0 })
    })

    test('touch drag on a part moves the whole train and never opens a marquee', async ({ playground: p }) => {
      const first = await p.add('Bar', 'three')
      const second = await p.add('Bar', 'five')
      await first.click()
      await second.click({ modifiers: ['Shift'] })
      const menu = await p.menu(first)
      await menu.getByRole('menuitem', { name: 'Make a train' }).click()

      const train = p.panel('Bar').locator('[data-piece-id]')
      await expect(train).toHaveCount(1)
      const parts = train.locator('.train-part')
      await expect(parts).toHaveCount(2)

      const before = await p.geometry(train)
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')
      const grab = await faceCenter(parts.nth(1))
      const delta = await columnDelta(p, 2)

      await p.touch.down(1, grab)
      await p.touch.move(1, { x: grab.x + delta.x, y: grab.y + delta.y })
      await expect(overlay).toHaveCount(0)
      await p.touch.up(1)

      await expect.poll(() => p.geometry(train)).toMatchObject({
        x: before.x + 2,
        y: before.y,
        offset: 0,
      })
      await expect(parts).toHaveCount(2)
      await expect(overlay).toHaveCount(0)
    })

    test('a second touch cannot move a rod during a marquee', async ({ playground: p }) => {
      const first = await p.add('Bar', 'six')
      const second = await p.add('Bar', 'three')
      const a = await p.geometry(first)
      const b = await p.geometry(second)
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')

      // Finger 1 sweeps only the first rod.
      const { from, to } = sweep([a])
      await p.touch.down(1, await p.boardClient('Bar', from))
      await p.touch.move(1, await p.boardClient('Bar', to))
      await expect(overlay).toBeVisible()
      await expect(first).toHaveClass(/--selected/)

      // Finger 2 grabs the second rod and drags it three cells right.
      const grab = await faceCenter(second)
      const delta = await columnDelta(p, 3)
      await p.touch.down(2, grab)
      await p.touch.move(2, { x: grab.x + delta.x, y: grab.y + delta.y })
      await expect.poll(() => p.geometry(second)).toMatchObject({ x: b.x, y: b.y, offset: 0 })
      await expect(overlay).toBeVisible()
      await p.touch.up(2)

      // The marquee is still held by finger 1 and commits on its release.
      await expect(overlay).toBeVisible()
      await p.touch.up(1)
      await expect(overlay).toHaveCount(0)
      await expect(first).toHaveClass(/--selected/)
      await expect(second).not.toHaveClass(/--selected/)
      await expect.poll(() => p.geometry(second)).toMatchObject({ x: b.x, y: b.y, offset: 0 })
    })

    test('a second touch cannot start a marquee during a rod drag', async ({ playground: p }) => {
      // The six spawns to the right of the three, leaving room to drag it further right.
      const other = await p.add('Bar', 'three')
      const dragged = await p.add('Bar', 'six')
      const a = await p.geometry(dragged)
      const b = await p.geometry(other)
      const overlay = p.panel('Bar').locator('[data-scene-marquee]')

      // Finger 1 drags the six one cell right and holds.
      const grab = await faceCenter(dragged)
      const delta = await columnDelta(p, 1)
      await p.touch.down(1, grab)
      await p.touch.move(1, { x: grab.x + delta.x, y: grab.y + delta.y })
      await expect.poll(async () => (await p.geometry(dragged)).offset).toBeGreaterThan(0.5)

      // Finger 2 sweeps empty board across the three.
      const { from, to } = sweep([b])
      await p.touch.down(2, await p.boardClient('Bar', from))
      await p.touch.move(2, await p.boardClient('Bar', to))
      await expect(overlay).toHaveCount(0)
      await expect(other).not.toHaveClass(/--selected/)
      await p.touch.up(2)

      await p.touch.up(1)
      await expect.poll(() => p.geometry(dragged)).toMatchObject({ x: a.x + 1, y: a.y, offset: 0 })
      await expect(other).not.toHaveClass(/--selected/)
      await expect(overlay).toHaveCount(0)
    })
  })
})
