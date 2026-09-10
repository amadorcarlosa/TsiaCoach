import { test, expect } from './fixtures/playground-fixture'

test('bar menu offers removal only and targets the clicked instance', async ({ playground: p }) => {
  const first = await p.add('Bar', 'six')
  const second = await p.add('Bar', 'six')
  await first.focus()
  const menu = await p.menu(second)
  await expect(second).toHaveClass(/--selected/)
  await expect(menu.getByRole('menuitemcheckbox')).toHaveCount(0)
  await expect(menu.getByRole('menuitem')).toHaveCount(3)
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

  test('a two-train throw clamps by the furthest-right part', async ({ page, playground: p }) => {
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
