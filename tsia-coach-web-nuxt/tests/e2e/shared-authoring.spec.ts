import type { Locator } from '@playwright/test'
import { test, expect, type Playground } from './fixtures/playground-fixture'

function authoring(panel: Locator) {
  const controls = panel.getByRole('group', { name: 'Authoring steps', exact: true })
  return {
    controls,
    capture: controls.getByRole('button', { name: 'Capture step', exact: true }),
    update: controls.getByRole('button', { name: 'Update step', exact: true }),
    step: (n: number) => controls.getByRole('button', { name: new RegExp(`^Step ${n}(?:$|\\s)`) }),
    prompt: panel.getByRole('group', { name: 'Unsaved step changes', exact: true }),
    details: panel.getByRole('group', { name: 'Step details', exact: true }),
    title: panel.getByRole('textbox', { name: 'Title', exact: true }),
    instruction: panel.getByRole('textbox', { name: 'Prompt', exact: true }),
    deletion: panel.getByRole('group', { name: 'Confirm step deletion', exact: true }),
  }
}

for (const kind of ['Bar', 'Array', 'Fraction'] as const) {
  test(`${kind} authoring edits metadata, reorders, cancels and confirms deletion`, async ({ playground: p }) => {
    const panel = await p.show(kind)
    const ui = authoring(panel)
    await p.add(kind, 'two')
    const original = await snapshot(p, panel)
    await ui.capture.click()
    await ui.title.fill('Original arrangement')
    await ui.instruction.fill('Compare these rods.')
    if (kind === 'Fraction') {
      await panel.getByRole('button', { name: /^Fraction 1 denominator/ }).click()
    }
    const added = await p.add(kind, 'three')
    const changed = await snapshot(p, panel)
    await ui.capture.click()
    await added.click()
    await expect(added).toHaveClass(/--selected/)
    await ui.title.fill('Second arrangement')
    await ui.instruction.fill('Explain what changed.\nUse the board.')
    const second = ui.controls.getByRole('button', { name: 'Second arrangement', exact: true })
    const first = ui.controls.getByRole('button', { name: 'Original arrangement', exact: true })
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(ui.update).toBeDisabled()
    await expect(ui.details.getByRole('button', { name: 'Move later', exact: true })).toBeDisabled()
    await ui.details.getByRole('button', { name: 'Move earlier', exact: true }).click()
    await expect(ui.controls.getByRole('button')).toHaveText(['Capture step', 'Update step', 'Second arrangement', 'Original arrangement'])
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(added).toHaveClass(/--selected/)
    await expect.poll(() => snapshot(p, panel)).toEqual(changed)
    await expect(ui.details.getByRole('button', { name: 'Move earlier', exact: true })).toBeDisabled()

    // Visit both snapshots so metadata edits and reordering cannot mask a save.
    await first.click()
    await expect.poll(() => snapshot(p, panel)).toEqual(original)
    await expect(ui.title).toHaveValue('Original arrangement')
    await expect(ui.instruction).toHaveValue('Compare these rods.')
    await second.click()
    await expect.poll(() => snapshot(p, panel)).toEqual(changed)
    await expect(ui.instruction).toHaveValue('Explain what changed.\nUse the board.')
    await ui.details.getByRole('button', { name: 'Delete step', exact: true }).click()
    await expect(ui.deletion).toContainText('Second arrangement')
    await expect(ui.prompt).toHaveCount(0)
    await expect(ui.title).toBeDisabled()
    await expect(ui.capture).toBeDisabled()
    await ui.deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(ui.deletion).toHaveCount(0)
    await expect(second).toBeFocused()
    await expect(ui.controls.getByRole('button')).toHaveCount(4)
    await expect.poll(() => snapshot(p, panel)).toEqual(changed)

    await ui.details.getByRole('button', { name: 'Delete step', exact: true }).click()
    await ui.deletion.getByRole('button', { name: 'Delete step', exact: true }).click()
    await expect(ui.deletion).toHaveCount(0)
    await expect(second).toHaveCount(0)
    await expect(first).toBeFocused()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(ui.controls.getByRole('button')).toHaveCount(3)
    await expect.poll(() => snapshot(p, panel)).toEqual(original)
    await expect(ui.title).toHaveValue('Original arrangement')
    await expect(ui.instruction).toHaveValue('Compare these rods.')
    await expect(ui.update).toBeDisabled()
  })
}

test('dirty deletion explicitly discards changes and offers cancellation to capture another step', async ({ playground: p }) => {
  const panel = await p.show('Bar')
  const ui = authoring(panel)
  await p.add('Bar', 'two')
  await ui.capture.click()
  const original = await snapshot(p, panel)
  await p.add('Bar', 'three')
  await ui.capture.click()
  await p.add('Bar', 'one')
  const working = await snapshot(p, panel)
  await ui.details.getByRole('button', { name: 'Delete step', exact: true }).click()
  await expect(ui.deletion).toContainText('Its unsaved board changes will also be discarded.')
  await expect(ui.deletion).toContainText('Cancel and capture another step if you want to keep them.')
  await expect(ui.deletion.getByRole('button')).toHaveText(['Delete step and discard changes', 'Cancel'])
  await expect(ui.prompt).toHaveCount(0)
  await ui.deletion.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(ui.step(2)).toBeFocused()
  await expect(ui.step(2)).toContainText('(unsaved)')
  await expect.poll(() => snapshot(p, panel)).toEqual(working)

  // Cancellation really does allow preserving the working board as another step.
  await ui.capture.click()
  await ui.step(2).click()
  await p.add('Bar', 'one')
  await ui.details.getByRole('button', { name: 'Delete step', exact: true }).click()
  await ui.deletion.getByRole('button', { name: 'Delete step and discard changes', exact: true }).click()
  await expect(ui.step(2)).toHaveCount(0)
  await expect(ui.step(3)).toBeFocused()
  await expect(ui.step(3)).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => snapshot(p, panel)).toEqual(working)
  await expect(ui.update).toBeDisabled()
  await ui.step(1).click()
  await expect.poll(() => snapshot(p, panel)).toEqual(original)
})

test('deleting the sole step clears the board and returns focus to Capture', async ({ playground: p }) => {
  const panel = await p.show('Fraction')
  const ui = authoring(panel)
  await p.add('Fraction', 'two')
  await ui.capture.click()
  await ui.title.fill('')
  await expect(ui.step(1)).toHaveText('Step 1')
  await ui.details.getByRole('button', { name: 'Delete step', exact: true }).click()
  await expect(ui.deletion).toContainText('Untitled step')
  await ui.deletion.getByRole('button', { name: 'Delete step', exact: true }).click()
  await expect(ui.deletion).toHaveCount(0)
  await expect(ui.controls.getByRole('button')).toHaveText(['Capture step', 'Update step'])
  await expect(ui.controls.getByRole('button', { pressed: true })).toHaveCount(0)
  await expect(ui.details).toHaveCount(0)
  await expect(panel.locator('[data-piece-id]')).toHaveCount(0)
  await expect(ui.update).toBeDisabled()
  await expect(ui.capture).toBeFocused()
  await ui.capture.click()
  await expect(ui.step(1)).toHaveAttribute('aria-pressed', 'true')
  await expect(ui.update).toBeDisabled()
})

async function snapshot(p: Playground, panel: Locator) {
  return Promise.all((await panel.locator('[data-piece-id]').all()).map(async train => ({
    id: await train.getAttribute('data-piece-id'),
    geometry: await p.geometry(train),
    parts: await Promise.all((await train.locator('.train-part').all()).map(async part => ({
      value: await part.getAttribute('data-part-value'),
      geometry: await p.geometry(part),
    }))),
  })))
}

async function factors(p: Playground, rod: Locator, label: string) {
  const menu = await p.menu(rod.locator('.train-part').first())
  await menu.getByRole('menuitem', { name: 'Regroup to factors', exact: true }).hover()
  await p.page.getByRole('menuitem', { name: label, exact: true }).click()
  await expect(p.page.getByRole('menu')).toHaveCount(0)
}

for (const kind of ['Bar', 'Array'] as const) {
  test(`${kind} authoring captures, edits, and restores its full train geometry`, async ({ playground: p }) => {
    const panel = await p.show(kind)
    const ui = authoring(panel)
    let editableTrain: Locator
    let rectangle: Locator | undefined
    if (kind === 'Bar') {
      const first = await p.add(kind, 'three')
      const second = await p.add(kind, 'five')
      await first.click()
      await second.click({ modifiers: ['Shift'] })
      const menu = await p.menu(first)
      await menu.getByRole('menuitem', { name: 'Make a train', exact: true }).click()
      editableTrain = panel.locator('[data-piece-id]').first()
      await expect(editableTrain.locator('.train-part')).toHaveCount(2)
      await expect.poll(() => p.geometry(editableTrain)).toMatchObject({ width: 8, depth: 1 })
    } else {
      editableTrain = await p.add(kind, 'two')
      const menu = await p.menu(editableTrain)
      await menu.getByRole('menuitemcheckbox', { name: 'Vertical', exact: true }).click()
      await expect.poll(() => p.geometry(editableTrain)).toMatchObject({ width: 1, depth: 2 })
      rectangle = await p.add(kind, 'six')
      await factors(p, rectangle, '2 rows of 3')
      await expect.poll(() => p.geometry(rectangle!)).toMatchObject({ width: 3, depth: 2 })
    }
    const original = await snapshot(p, panel)
    await ui.capture.click()
    await expect(ui.step(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(ui.update).toBeDisabled()
    expect(await ui.controls.evaluate(el => !!el.closest('.board-viewport, .array-viewport'))).toBe(false)

    // Selection is transient; changes to nested train parts are persisted edits.
    await editableTrain.locator('.train-part').first().click()
    await expect(ui.step(1)).toHaveText('Step 1')
    const menu = await p.menu(editableTrain.locator('.train-part').first())
    await menu.getByRole('menuitem', { name: 'Regroup to ones', exact: true }).click()
    await expect(editableTrain.locator('.train-part')).toHaveCount(kind === 'Bar' ? 8 : 2)
    if (rectangle) await factors(p, rectangle, '3 rows of 2')
    await expect(ui.step(1)).toContainText('(unsaved)')
    await expect(ui.update).toBeEnabled()
    const changed = await snapshot(p, panel)
    expect(changed).not.toEqual(original)
    await ui.capture.click()
    await expect(ui.step(2)).toHaveText('Step 2')
    await expect(ui.update).toBeDisabled()

    await ui.step(1).click()
    await expect.poll(() => snapshot(p, panel)).toEqual(original)
    await expect(ui.step(1)).toHaveText('Step 1')
    await expect(ui.update).toBeDisabled()
    await p.add(kind, 'one')
    await expect(ui.step(1)).toContainText('(unsaved)')
    await ui.step(2).click()
    await expect(ui.prompt).toBeVisible()
    await ui.prompt.getByRole('button', { name: 'Discard and switch', exact: true }).click()
    await expect.poll(() => snapshot(p, panel)).toEqual(changed)
    await ui.step(1).click()
    await expect.poll(() => snapshot(p, panel)).toEqual(original)
    await expect(ui.step(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(ui.update).toBeDisabled()
  })
}

test('tabs preserve independent authoring steps and pending decisions', async ({ playground: p }) => {
  const barPanel = await p.show('Bar')
  const bar = authoring(barPanel)
  await p.add('Bar', 'three')
  await bar.capture.click()
  await p.add('Bar', 'two')
  await bar.capture.click()
  await p.add('Bar', 'one')
  await bar.step(1).click()
  await expect(bar.prompt).toBeVisible()

  const arrayPanel = await p.show('Array')
  const array = authoring(arrayPanel)
  await expect(array.step(1)).toHaveCount(0)
  await expect(array.prompt).toHaveCount(0)
  await p.add('Array', 'six')
  await array.capture.click()
  await array.capture.click()
  await p.add('Array', 'one')
  await array.step(1).click()
  await expect(array.prompt).toBeVisible()

  await p.show('Bar')
  await expect(bar.prompt).toBeVisible()
  await expect(bar.step(2)).toContainText('(unsaved)')
  await expect(barPanel.locator('[data-piece-id]')).toHaveCount(3)
  await bar.prompt.getByRole('button', { name: 'Save and switch', exact: true }).click()
  await bar.step(2).click()
  await expect(barPanel.locator('[data-piece-id]')).toHaveCount(3)
  await expect(bar.update).toBeDisabled()

  await p.show('Array')
  await expect(array.prompt).toBeVisible()
  await expect(array.step(2)).toContainText('(unsaved)')
  await expect(arrayPanel.locator('[data-piece-id]')).toHaveCount(2)
  await array.prompt.getByRole('button', { name: 'Discard and switch', exact: true }).click()
  await expect(arrayPanel.locator('[data-piece-id]')).toHaveCount(1)
  await expect(array.update).toBeDisabled()

  const fraction = authoring(await p.show('Fraction'))
  await expect(fraction.step(1)).toHaveCount(0)
  await expect(fraction.prompt).toHaveCount(0)
})
