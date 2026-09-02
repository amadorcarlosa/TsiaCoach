import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown } | null)
      ?.__vue_app__,
  ))
}

/**
 * Moves a draggable quantity part into the Sum lane using the accessible
 * keyboard drag path: Enter picks the part up, ArrowRight selects the
 * accepting Sum zone, Enter drops it. The role="button" locator only matches
 * once useDraggablePiece has mounted, so it doubles as the readiness wait.
 */
async function movePartToSum(
  page: Page,
  accessibleName: string | RegExp,
) {
  const part = page.getByRole('button', { name: accessibleName })
  await expect(part).toBeVisible()
  await part.focus()
  await part.press('Enter')
  await part.press('ArrowRight')
  await part.press('Enter')
  // The drop lands after a short snap animation; wait for the scene to mark
  // the part as joined so a submit cannot race the drop callback.
  await expect(part).toHaveClass(/is-joined/)
}

test('wrong evidence stays, correct evidence advances, and reload resumes', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-1' },
  })
  expect(started.ok()).toBeTruthy()
  const attempt = await started.json() as { attemptId: string }
  for (let check = 0; check < 2; check++) {
    const response = await request.post(`/api/attempts/${attempt.attemptId}/checks`, {
      data: { selectedAnswerId: 'answer-b' },
    })
    expect(response.ok()).toBeTruthy()
  }

  const submittedBodies: unknown[] = []
  page.on('request', request => {
    if (request.method() === 'POST' && request.url().includes('/scaffold-sessions/') && request.url().endsWith('/checks')) {
      submittedBodies.push(request.postDataJSON())
    }
  })

  await page.goto(`/scaffolds/${attempt.attemptId}`)
  await waitForNuxtHydration(page)

  await expect(page.locator('[data-step-id="step-join-and-read-sum"]')).toBeVisible()
  await movePartToSum(page, 'First part, n')
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-join-and-read-sum"]')).toBeVisible()
  await expect(page.getByText(/does not match the model yet/i)).toBeVisible()
  expect(submittedBodies[0]).toEqual({
    type: 'joinQuantities',
    parts: [{ type: 'semanticQuantity', semanticEntityId: 'entity-n' }],
  })
  const firstBody = JSON.stringify(submittedBodies[0])
  expect(firstBody).not.toContain('satisfied')
  expect(firstBody).not.toContain('expected')
  expect(firstBody).not.toContain('correct')
  expect(firstBody).not.toContain('successCheck')

  await movePartToSum(page, 'Next part, n + 2')
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-name-bar-count"]')).toBeVisible()
  expect(submittedBodies[1]).toEqual({
    type: 'joinQuantities',
    parts: [
      { type: 'semanticQuantity', semanticEntityId: 'entity-n' },
      { type: 'latentExpression', latentMathId: 'latent-second-member' },
    ],
  })
  const secondBody = JSON.stringify(submittedBodies[1])
  expect(secondBody).not.toContain('satisfied')
  expect(secondBody).not.toContain('correct')

  await page.reload()
  await waitForNuxtHydration(page)
  await expect(page.locator('[data-step-id="step-name-bar-count"]')).toBeVisible()
})

test('help before any check opens the walkthrough at the floor step', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-1' },
  })
  expect(started.ok()).toBeTruthy()
  const attempt = await started.json() as { attemptId: string }

  await page.goto(`/scaffolds/${attempt.attemptId}`)
  await waitForNuxtHydration(page)
  await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()
})

async function dragPiece(page: Page, length: number, targetX: number, targetY: number) {
  const supply = page.locator(`[data-step-id="step-rebuild-from-twos-and-ones"] .supply-piece[data-length="${length}"]`)
  const box = await supply.boundingBox()
  if (!box) throw new Error('supply piece not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + 40, { steps: 4 })
  await page.mouse.move(targetX, targetY, { steps: 12 })
  await page.mouse.up()
}

test('a legal drop stays, a rule-breaking drop reverts, and the board survives a reload', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-1' },
  })
  expect(started.ok()).toBeTruthy()
  const attempt = await started.json() as { attemptId: string }

  await page.goto(`/scaffolds/${attempt.attemptId}`)
  await waitForNuxtHydration(page)
  const board = page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')
  await expect(board).toBeVisible()
  const grid = await board.locator('.grid').boundingBox()
  if (!grid) throw new Error('grid not visible')
  const unit = 28

  // A red two on the 4, from column 1: legal and accepted.
  const accepted = page.waitForResponse('**/checks')
  await dragPiece(page, 2, grid.x + 1 * unit + unit, grid.y + 4 * unit + unit / 2)
  await accepted
  await expect(board.locator('[data-role="placed"][data-length="2"][data-y="4"]')).toHaveCount(1)

  // A white on the 4 breaks "as many twos as fit": shown, then taken back.
  const rejected = page.waitForResponse('**/checks')
  await dragPiece(page, 1, grid.x + 3 * unit + unit / 2, grid.y + 4 * unit + unit / 2)
  await rejected
  await expect(board.locator('[data-role="placed"][data-length="1"]')).toHaveCount(0, { timeout: 3000 })
  await expect(board.locator('[data-role="placed"]')).toHaveCount(1)

  await page.reload()
  await waitForNuxtHydration(page)
  await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"] [data-role="placed"][data-length="2"][data-y="4"]')).toHaveCount(1)
})

test('an item without a scaffold shows a safe error', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-2' },
  })
  expect(started.ok()).toBeTruthy()
  const attempt = await started.json() as { attemptId: string }

  const checked = await request.post(`/api/attempts/${attempt.attemptId}/checks`, {
    data: { selectedAnswerId: 'answer-b' },
  })
  expect(checked.ok()).toBeTruthy()

  await page.goto(`/scaffolds/${attempt.attemptId}`)
  await waitForNuxtHydration(page)
  const alert = page.getByTestId('scaffold-safe-error')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('not available yet')
  await expect(alert).not.toContainText('stopped-at-this-year')
})

test('ask the coach sends only the step id and the question, and shows the authored reply', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-1' },
  })
  expect(started.ok()).toBeTruthy()
  const attempt = await started.json() as { attemptId: string }

  const captured: Record<string, unknown>[] = []
  await page.route('**/api/attempts/*/coach', async (route) => {
    captured.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        move: {
          type: 'answerQuestion',
          message: 'A piece comes back when it breaks the rule.',
          focusPhraseIds: [],
          stepId: 'step-rebuild-from-twos-and-ones',
        },
      }),
    })
  })

  await page.goto(`/scaffolds/${attempt.attemptId}`)
  await waitForNuxtHydration(page)
  await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()

  await page.getByTestId('ask-coach').click()
  await page.getByLabel('Your question for the coach').fill('why did my white come back?')
  await page.getByTestId('coach-send').click()

  await expect(page.getByTestId('coach-reply')).toContainText('A piece comes back when it breaks the rule.')
  expect(captured).toEqual([{
    event: 'stepQuestionAsked',
    stepId: 'step-rebuild-from-twos-and-ones',
    question: 'why did my white come back?',
  }])
  // The student stays on the step: a question never routes.
  await expect(page.locator('[data-step-id="step-rebuild-from-twos-and-ones"]')).toBeVisible()
})
