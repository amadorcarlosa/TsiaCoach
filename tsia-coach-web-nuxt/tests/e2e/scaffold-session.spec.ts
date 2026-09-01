import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown } | null)
      ?.__vue_app__,
  ))
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
  await page.waitForTimeout(1000)

  await expect(page.locator('[data-step-id="step-join-known-quantities"]')).toBeVisible()
  await page.getByRole('button', { name: /Part 1/ }).click()
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-join-known-quantities"]')).toBeVisible()
  await expect(page.getByText(/does not match the model yet/i)).toBeVisible()
  expect(submittedBodies[0]).toEqual({
    type: 'joinQuantities',
    parts: [{ type: 'semanticQuantity', semanticEntityId: 'entity-n' }],
  })
  expect(JSON.stringify(submittedBodies[0])).not.toContain('satisfied')

  await page.getByRole('button', { name: /Part 2/ }).click()
  await page.getByTestId('check-scaffold-response').click()
  await expect(page.locator('[data-step-id="step-count-base-parts"]')).toBeVisible()

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
