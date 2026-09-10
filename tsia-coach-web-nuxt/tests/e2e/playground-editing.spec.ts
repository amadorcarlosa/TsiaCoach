import { test, expect } from './fixtures/playground-fixture'

test('bar menu offers removal only and targets the clicked instance', async ({ playground: p }) => {
  const first = await p.add('Bar', 'six')
  const second = await p.add('Bar', 'six')
  await first.focus()
  const menu = await p.menu(second)
  await expect(second).toHaveClass(/--selected/)
  await expect(menu.getByRole('menuitemcheckbox')).toHaveCount(0)
  await expect(menu.getByRole('menuitem')).toHaveCount(2)
  await menu.getByRole('menuitem', { name: 'Delete' }).click()
  await expect(second).toHaveCount(0)
  await expect(first).toBeVisible()
  await expect(p.panel('Bar').getByRole('button', { name: /remove selected rod/i })).toBeDisabled()
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
  test.use({ contextOptions: { reducedMotion: 'no-preference' } })

  test('an out-of-bounds throw returns to its committed position', async ({ playground: p }) => {
    const rod = await p.add('Bar', 'six')
    await p.drag(rod, -2, 0)
    await expect(p.panel('Bar').getByRole('status').filter({ hasText: /inside the board/ })).toBeVisible()
    await expect.poll(() => p.geometry(rod)).toMatchObject({ x: 0, y: 2, offset: 0 })
    const menu = await p.menu(rod, true)
    await menu.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(rod).toHaveCount(0)
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

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(face.x + face.width / 2 + 90, face.y + face.height / 2 + 15, { steps: 8 })
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

    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    await page.mouse.move(face.x + face.width / 2 + 75, face.y + face.height / 2 + 15, { steps: 8 })
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
