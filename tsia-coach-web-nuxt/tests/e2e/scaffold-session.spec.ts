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

  await expect(page.locator('[data-step-id="step-join-known-quantities"]')).toBeVisible()
  await movePartToSum(page, 'First part, 15')
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-join-known-quantities"]')).toBeVisible()
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

  await movePartToSum(page, 'Next part, 17')
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-count-base-parts"]')).toBeVisible()
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
  await expect(page.locator('[data-step-id="step-count-base-parts"]')).toBeVisible()
})

test('unauthorized scaffold entry shows a safe error', async ({ page, request }) => {
  const started = await request.post('/api/attempts', {
    data: { practiceItemId: 'practice-item-sample-1' },
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
  await expect(alert).not.toContainText('stopped-at-second-integer')
})
