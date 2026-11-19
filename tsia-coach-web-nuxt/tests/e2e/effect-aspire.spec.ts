import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Response } from '@playwright/test'

/** Real services only: a deterministic incorrect check never invokes a paid AI provider. */
test('Atom hydration and a browser answer check reach the real C# API with W3C trace context', async ({ page, request }, testInfo) => {
  const browserAttemptStarts: string[] = []
  const hydrationMessages: string[] = []
  const browserErrors: string[] = []
  const browserExports: Response[] = []
  page.on('response', response => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/telemetry/traces') {
      browserExports.push(response)
    }
  })
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', message => {
    if ((message.type() === 'warning' || message.type() === 'error') && /hydration|mismatch/i.test(message.text())) {
      hydrationMessages.push(message.text())
    }
  })
  page.on('request', sent => {
    if (sent.method() === 'POST' && new URL(sent.url()).pathname === '/api/attempts') {
      browserAttemptStarts.push(sent.url())
    }
  })

  await page.goto('/sample-Items')
  await page.waitForFunction(() => {
    const app = (document.querySelector('#__nuxt') as Element & {
      __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
    } | null)?.__vue_app__
    return app?.config?.globalProperties?.$nuxt?.isHydrating === false
  })

  // The SSR-created attempt must survive Atom hydration without another POST.
  await expect(page.locator('article[data-practice-item-id="practice-item-sample-1"]')).toBeVisible()
  expect(browserAttemptStarts).toHaveLength(0)
  const answer = page.locator('[data-answer-choice-id="answer-b"]')
  await answer.click()
  await expect(answer).toHaveAttribute('aria-checked', 'true')

  const checkedResponse = page.waitForResponse(response => response.request().method() === 'POST'
    && /\/api\/attempts\/[^/]+\/checks$/.test(new URL(response.url()).pathname))
  await page.getByRole('button', { name: 'Check answer', exact: true }).click()
  const checked = await checkedResponse
  expect(checked.ok()).toBe(true)
  expect(checked.request().postDataJSON()).toEqual({ selectedAnswerId: 'answer-b' })

  const projection = await checked.json() as { attemptId: string; phase: { type: string }; checkCount: number }
  expect(projection.phase.type).toBe('afterIncorrectCheck')
  expect(projection.checkCount).toBe(1)
  await expect(page.getByText('Try another expression', { exact: true })).toBeVisible()

  const traceparent = checked.request().headers()['traceparent']
  expect(traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  const traceId = traceparent!.split('-')[1]!
  const persisted = await request.get(`/api/attempts/${encodeURIComponent(projection.attemptId)}`)
  expect(persisted.ok()).toBe(true)
  expect(await persisted.json()).toMatchObject({
    attemptId: projection.attemptId,
    checkCount: 1,
    phase: { type: 'afterIncorrectCheck' },
  })

  // Wait for the browser's actual protobuf batch, rather than closing its context
  // while the final action is still waiting for the exporter's batch interval.
  const traceIdBytes = Buffer.from(traceId, 'hex')
  const containsTrace = (response: Response) => response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/telemetry/traces'
    && response.request().postDataBuffer()?.includes(traceIdBytes) === true
  const browserExport = browserExports.find(containsTrace)
    ?? await page.waitForResponse(containsTrace)
  expect(browserExport.status(), 'the browser trace batch must be accepted by the server proxy').toBe(204)
  expect(browserExport.request().postDataBuffer()?.includes(traceIdBytes)).toBe(true)

  // The Aspire telemetry check can use this trace ID to assert cross-service parentage.
  const capturePath = testInfo.outputPath('trace.json')
  await writeFile(capturePath, JSON.stringify({ traceId, traceparent, browserExportTraceId: traceId, browserExportStatus: browserExport.status(), attemptId: projection.attemptId }, null, 2))
  await testInfo.attach('effect-aspire-trace', { path: capturePath, contentType: 'application/json' })
  console.info(`EFFECT_ASPIRE_TRACE_ID=${traceId}`)
  expect.soft(hydrationMessages, 'SSR and client Atom state must hydrate without mismatches').toEqual([])
  expect.soft(browserErrors, 'the workflow must not throw browser errors').toEqual([])
})
