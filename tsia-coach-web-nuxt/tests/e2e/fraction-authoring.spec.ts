import type { Locator } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

async function captureFractions(p: Playground) {
  const panel = await p.show('Fraction')
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  const readout = panel.locator('[data-fraction-pair="pair-0"]')
  const track = (name: 'numerator' | 'denominator') =>
    panel.getByRole('button', { name: new RegExp(`^Fraction 1 ${name}`) })
  const step = (number: number) => controls.getByRole('button', { name: new RegExp(`^Step ${number}`) })

  await expect(controls.getByRole('button', { name: 'Update step' })).toBeDisabled()
  const numerator = await p.add('Fraction', 'two')
  await track('denominator').click()
  const denominator = await p.add('Fraction', 'three')
  await expect(readout).toHaveText('Fraction 1: 2/3')
  await controls.getByRole('button', { name: 'Capture step' }).click()
  await expect(step(1)).toHaveAttribute('aria-pressed', 'true')

  await p.add('Fraction', 'one')
  await expect(readout).toHaveText('Fraction 1: 2/4')
  await controls.getByRole('button', { name: 'Capture step' }).click()
  await expect(step(2)).toHaveAttribute('aria-pressed', 'true')
  await step(1).click()
  await expect(readout).toHaveText('Fraction 1: 2/3')
  await expect(panel.locator('[data-piece-id]')).toHaveCount(2)

  return { panel, controls, readout, track, step, numerator, denominator }
}

test.describe('Fraction authoring', () => {
  for (const decision of ['Cancel', 'Discard and switch', 'Save and switch'] as const) {
    test(`${decision} preserves its distinct outcome`, async ({ playground: p }) => {
      const { panel, controls, readout, track, step, numerator } = await captureFractions(p)

      // Selection alone must leave the captured step clean.
      await numerator.click()
      await expect(step(1)).toHaveText('Step 1')
      await expect(controls.getByRole('button', { name: 'Update step' })).toBeDisabled()
      await track('numerator').click()
      await p.add('Fraction', 'one')
      await expect(readout).toHaveText('Fraction 1: 3/3')
      await expect(step(1)).toContainText('(unsaved)')
      await expect(controls.getByRole('button', { name: 'Update step' })).toBeEnabled()
      await step(2).click()
      const prompt = panel.getByRole('group', { name: 'Unsaved step changes', exact: true })
      await expect(prompt).toBeVisible()
      for (const button of await controls.getByRole('button').all()) {
        await expect(button).toBeDisabled()
      }
      await prompt.getByRole('button', { name: decision, exact: true }).click()
      await expect(prompt).toHaveCount(0)

      if (decision === 'Cancel') {
        await expect(readout).toHaveText('Fraction 1: 3/3')
        await expect(step(1)).toHaveAttribute('aria-pressed', 'true')
        await expect(step(1)).toContainText('(unsaved)')
        await controls.getByRole('button', { name: 'Update step' }).click()
        await expect(step(1)).toHaveText('Step 1')
        await step(2).click()
        await step(1).click()
        await expect(readout).toHaveText('Fraction 1: 3/3')
      } else {
        await expect(readout).toHaveText('Fraction 1: 2/4')
        await expect(step(2)).toHaveAttribute('aria-pressed', 'true')
        await expect(step(1)).toHaveText('Step 1')
        await step(1).click()
        await expect(readout).toHaveText(
          decision === 'Save and switch' ? 'Fraction 1: 3/3' : 'Fraction 1: 2/3',
        )
      }
      await expect(panel.getByRole('menu')).toHaveCount(0)
    })
  }

  async function previewOffset(rod: Locator) {
    return rod.evaluate(el => {
      const style = getComputedStyle(el)
      const matrix = new DOMMatrixReadOnly(style.transform)
      const translate = style.translate === 'none'
        ? [0, 0] : style.translate.split(/\s+/).map(Number.parseFloat)
      return Math.max(
        Math.abs(matrix.m41), Math.abs(matrix.m42),
        Math.abs(translate[0] ?? 0), Math.abs(translate[1] ?? 0),
      )
    })
  }

  test('restoring a step cancels held drag and follower translation without a late commit or stale menu', async ({ page, playground: p }) => {
    const { readout, step, numerator, denominator } = await captureFractions(p)
    const beforeNumerator = await p.geometry(numerator)
    const beforeDenominator = await p.geometry(denominator)
    await numerator.click()
    await denominator.click({ modifiers: ['Shift'] })
    await expect(numerator).toHaveClass(/--selected/)
    await expect(denominator).toHaveClass(/--selected/)
    const face = await numerator.locator('.face.top').boundingBox()
    if (!face) throw new Error('Missing numerator face')
    const origin = await p.boardClient('Fraction', { x: 0, y: 0 })
    const moved = await p.boardClient('Fraction', { x: 3, y: 0 })
    await page.mouse.move(face.x + face.width / 2, face.y + face.height / 2)
    await page.mouse.down()
    try {
      await page.mouse.move(
        face.x + face.width / 2 + moved.x - origin.x,
        face.y + face.height / 2 + moved.y - origin.y,
        { steps: 8 },
      )
      await expect.poll(() => previewOffset(numerator)).toBeGreaterThan(0.05)
      await expect.poll(() => previewOffset(denominator)).toBeGreaterThan(0.05)
      await expect(step(1)).toHaveText('Step 1')
      // Keyboard activation permits restoring while the pointer is still held.
      await step(2).focus()
      await page.keyboard.press('Enter')
      await expect(readout).toHaveText('Fraction 1: 2/4')
      await expect.poll(() => previewOffset(numerator)).toBeLessThan(0.05)
      await expect.poll(() => previewOffset(denominator)).toBeLessThan(0.05)
    } finally {
      await page.mouse.up()
    }
    await expect.poll(() => p.geometry(numerator)).toEqual(beforeNumerator)
    await expect.poll(() => p.geometry(denominator)).toEqual(beforeDenominator)
    await expect(step(2)).toHaveText('Step 2')
    await expect(numerator).not.toHaveClass(/--selected/)
    await expect(denominator).not.toHaveClass(/--selected/)

    const menu = await p.menu(numerator, true)
    await expect(step(1)).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await step(1).click()
    await expect(readout).toHaveText('Fraction 1: 2/3')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect.poll(() => previewOffset(numerator)).toBeLessThan(0.05)
    await expect.poll(() => previewOffset(denominator)).toBeLessThan(0.05)
  })

  test('authoring controls wrap outside the clipped board and disable in portrait preview', async ({ page, playground: p }) => {
    const { panel, controls, step } = await captureFractions(p)
    for (let i = 0; i < 8; i++) {
      await controls.getByRole('button', { name: 'Capture step' }).click()
    }
    await page.setViewportSize({ width: 740, height: 500 })
    await expect(step(10)).toBeVisible()
    const layout = await controls.evaluate(el => {
      const bounds = el.getBoundingClientRect()
      return {
        insideBoard: !!el.closest('.board-viewport'),
        rows: new Set(Array.from(el.querySelectorAll('button')).map(b => b.getBoundingClientRect().top)).size,
        fits: Array.from(el.querySelectorAll('button')).every(b => {
          const rect = b.getBoundingClientRect()
          return rect.left >= bounds.left && rect.right <= bounds.right + 1
        }),
      }
    })
    expect(layout.insideBoard).toBe(false)
    expect(layout.rows).toBeGreaterThan(1)
    expect(layout.fits).toBe(true)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(panel.getByText('Portrait preview: 0-12.', { exact: true })).toBeVisible()
    for (const button of await controls.getByRole('button').all()) {
      await expect(button).toBeDisabled()
    }
  })
})
