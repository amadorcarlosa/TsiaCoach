import { expect, test } from '@playwright/test'
import type { Page, Route } from '@playwright/test'

const FORBIDDEN_REQUEST_KEYS = [
  'model',
  'instructions',
  'history',
  'phase',
  'misconception',
  'suggestedStepId',
  'correctAnswerId',
]

interface CapturedCoachRequest {
  url: string
  body: Record<string, unknown>
}

async function waitForNuxtHydration(page: Page) {
  await page.waitForFunction(() => Boolean(
    (document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown } | null)
      ?.__vue_app__,
  ))
}

function assertExactEventBody(request: CapturedCoachRequest, event: string) {
  expect(request.body).toEqual({ event })
  for (const key of FORBIDDEN_REQUEST_KEYS) {
    expect(request.body).not.toHaveProperty(key)
  }
}

function mockCoachRoute(
  page: Page,
  respond: (route: Route) => Promise<void>,
): CapturedCoachRequest[] {
  const captured: CapturedCoachRequest[] = []

  void page.route('**/api/attempts/*/coach', async (route) => {
    captured.push({
      url: route.request().url(),
      body: route.request().postDataJSON() as Record<string, unknown>,
    })
    await respond(route)
  })

  return captured
}

function coachMoveResponse(move: Record<string, unknown>) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ move }),
  }
}

async function openSampleItems(page: Page) {
  await page.goto('/sample-Items')
  await waitForNuxtHydration(page)
}

/**
 * SSR renders the buttons before Vue hydration attaches listeners, so an
 * immediate click can be silently lost. Re-click until the UI confirms it.
 */
async function selectAnswer(page: Page, answerId: string) {
  const answer = page.locator(`[data-answer-choice-id="${answerId}"]`)
  await expect(async () => {
    await answer.click()
    await expect(answer).toHaveAttribute('aria-checked', 'true', { timeout: 500 })
  }).toPass()
}

async function submitAnswer(page: Page, answerId: string) {
  await selectAnswer(page, answerId)
  const check = page.waitForResponse('**/checks')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await check
}

async function requestCoaching(page: Page) {
  const coachResponse = page.waitForResponse('**/coach')
  await expect(async () => {
    await page.getByTestId('coaching-button').click()
    await Promise.race([
      coachResponse,
      new Promise((_, reject) => setTimeout(() => reject(new Error('coach request not sent')), 500)),
    ])
  }).toPass()
  await coachResponse
}

test('before-check help sends only helpRequested and highlights returned phrase', async ({ page }) => {
  const captured = mockCoachRoute(page, route => route.fulfill(coachMoveResponse({
    type: 'askReadingQuestion',
    message: 'Which phrase describes how the two integers are related?',
    focusPhraseIds: ['phrase-ordered-step'],
  })))

  await openSampleItems(page)

  await expect(page.getByTestId('coaching-button')).toHaveText(/Help/)
  await requestCoaching(page)

  await expect(page.getByTestId('coaching-message'))
    .toHaveText('Which phrase describes how the two integers are related?')

  expect(captured).toHaveLength(1)
  assertExactEventBody(captured[0]!, 'helpRequested')

  await expect(page.locator(
    '.interactive-segment.is-focused[data-phrase-ids~="phrase-ordered-step"]',
  ).first()).toBeVisible()
})

test('incorrect answer changes control to Diagnosis and renders diagnosis move', async ({ page }) => {
  const captured = mockCoachRoute(page, route => route.fulfill(coachMoveResponse({
    type: 'diagnoseDifference',
    message: 'Your answer names only the second integer, not the sum of both integers.',
    focusPhraseIds: ['phrase-target'],
  })))

  await openSampleItems(page)
  await submitAnswer(page, 'answer-b')

  await expect(page.getByTestId('coaching-button')).toHaveText(/Diagnosis/)
  await requestCoaching(page)

  await expect(page.getByTestId('coaching-card')).toBeVisible()
  await expect(page.getByTestId('coaching-message'))
    .toHaveText('Your answer names only the second integer, not the sum of both integers.')

  expect(captured).toHaveLength(1)
  assertExactEventBody(captured[0]!, 'diagnosisRequested')
})

test('suggestScaffold opens walkthrough by attemptId rather than suggestedStepId', async ({ page }) => {
  const captured = mockCoachRoute(page, route => route.fulfill(coachMoveResponse({
    type: 'suggestScaffold',
    message: 'A guided walkthrough can rebuild the expression step by step.',
    focusPhraseIds: [],
    suggestedStepId: 'step-join-known-quantities',
  })))

  await openSampleItems(page)

  await submitAnswer(page, 'answer-b')
  await expect(page.getByTestId('coaching-button')).toHaveText(/Diagnosis/)

  const secondCheck = page.waitForResponse('**/checks')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await secondCheck

  await requestCoaching(page)

  expect(captured).toHaveLength(1)
  assertExactEventBody(captured[0]!, 'diagnosisRequested')
  const attemptId = /\/api\/attempts\/([^/]+)\/coach/.exec(captured[0]!.url)?.[1]
  expect(attemptId).toBeTruthy()

  const walkthrough = page.getByTestId('coaching-open-scaffold')
  await expect(walkthrough).toBeVisible()

  const scaffoldRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('scaffold')) {
      scaffoldRequests.push(`${request.url()} ${request.postData() ?? ''}`)
    }
  })

  await walkthrough.click()
  await page.waitForURL(`**/scaffolds/${attemptId}`)

  expect(page.url()).toContain(`/scaffolds/${attemptId}`)
  expect(page.url()).not.toContain('step-join-known-quantities')
  for (const entry of scaffoldRequests) {
    expect(entry).not.toContain('suggestedStepId')
  }
})

test('correct answer changes control to Why it works and renders explanation', async ({ page }) => {
  const captured = mockCoachRoute(page, route => route.fulfill(coachMoveResponse({
    type: 'explainWhy',
    message: 'The expression joins the two consecutive odd integers into one sum.',
    focusPhraseIds: ['phrase-target'],
    provenanceFactIds: ['latent-ordered-step'],
  })))

  await openSampleItems(page)
  await submitAnswer(page, 'answer-d')

  await expect(page.getByTestId('coaching-button')).toHaveText(/Why it works/)
  await requestCoaching(page)

  await expect(page.getByTestId('coaching-message'))
    .toHaveText('The expression joins the two consecutive odd integers into one sum.')
  await expect(page.getByTestId('coaching-card')).not.toContainText('latent-ordered-step')

  expect(captured).toHaveLength(1)
  assertExactEventBody(captured[0]!, 'explainCorrect')
})

test('rate-limited response shows safe retry state', async ({ page }) => {
  let calls = 0
  const captured = mockCoachRoute(page, async (route) => {
    calls += 1
    if (calls === 1) {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 429,
          statusMessage: 'The coach is busy. Try again in a moment.',
        }),
      })
      return
    }

    await route.fulfill(coachMoveResponse({
      type: 'askReadingQuestion',
      message: 'Read the first sentence again.',
      focusPhraseIds: [],
    }))
  })

  await openSampleItems(page)
  await requestCoaching(page)

  const error = page.getByTestId('coaching-error')
  await expect(error).toBeVisible()
  await expect(error).toContainText('The coach is busy. Try again in a moment.')
  await expect(error).not.toContainText('provider')
  await expect(error).not.toContainText('429')

  await page.getByTestId('coaching-retry').click()
  await expect(page.getByTestId('coaching-message'))
    .toHaveText('Read the first sentence again.')

  expect(captured).toHaveLength(2)
  assertExactEventBody(captured[0]!, 'helpRequested')
  assertExactEventBody(captured[1]!, 'helpRequested')
})
