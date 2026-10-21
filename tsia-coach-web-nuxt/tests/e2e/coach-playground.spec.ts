import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/models', route => route.fulfill({ json: [{ name: 'test/model', displayName: 'Test model', vendor: 'openRouter' }] }))
})

test('captures real pieces, preserves snapshots, and inspects valid and invalid responses', async ({ page }) => {
  const requests: { state: { trains: unknown[], board: { kind: string } }, instructions: string }[] = []
  await page.route('**/api/decisions', async route => {
    requests.push(route.request().postDataJSON())
    if (requests.length === 2) return route.fulfill({ status: 502, json: { statusMessage: 'Invalid Jev response' } })
    await route.fulfill({ json: { action: 'hint', confidence: 0.91, probabilities: { hint: 0.93, ask: 0.04, observe: 0, demonstrate: 0.03 }, model: 'typesafe/jev-1.13', usage: { input_tokens: 42, output_tokens: 12 }, raw: { answers: { intervention: { choice: 'hint' } } }, request: { state: requests.at(-1)!.state } } })
  })
  await page.goto('/admin/chat')
  await expect(page.getByRole('heading', { name: 'Coach playground' })).toBeVisible()
  await page.getByRole('button', { name: 'Choose three rod', exact: true }).first().click()
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await expect(page.getByText('Confidence: 91.0%', { exact: true })).toBeVisible()
  expect(requests[0]!.state.trains).toHaveLength(1)
  await page.getByRole('button', { name: 'Clear board', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm clear' }).click()
  await page.getByText('Captured board and student input', { exact: true }).click()
  await expect(page.locator('.run-detail pre:visible').filter({ hasText: '"trains"' })).toContainText('"value": 3')
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await expect(page.locator('.run-detail [role=alert]')).toContainText('Invalid Jev response')
  expect(requests[1]!.state.trains).toHaveLength(0)
  await page.getByRole('button', { name: 'MathTabla', exact: true }).click()
  await page.getByRole('button', { name: 'Choose five rod', exact: true }).last().click()
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await expect.poll(() => requests.length).toBe(3)
  expect(requests[2]!.state.board.kind).toBe('mathtabla')
  expect(requests[2]!.state.trains).toHaveLength(1)
  await page.screenshot({ path: '../output/coach-playground-desktop.png', fullPage: true })
})

test('supports prose, provider errors, and cancellation without losing the board', async ({ page }) => {
  let calls = 0
  await page.route('**/api/agent', async route => {
    calls++
    if (calls === 1) await route.fulfill({ json: { text: 'Try a red rod.', model: 'test/model', inputTokens: 10, outputTokens: 5 } })
    else if (calls === 2) await route.fulfill({ status: 502, json: { statusMessage: 'Provider unavailable' } })
    // Leave the third request pending so the user can cancel it.
  })
  await page.goto('/admin/chat')
  await expect(page.getByRole('button', { name: 'Capture board & run' })).toBeEnabled()
  await page.getByLabel('Coaching response', { exact: true }).check()
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await expect(page.locator('.coach-response')).toHaveText('Try a red rod.')
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await expect(page.locator('.run-detail [role=alert]')).toContainText('Provider unavailable')
  await page.getByRole('button', { name: 'Capture board & run' }).click()
  await page.getByRole('button', { name: 'Cancel run' }).click()
  await expect(page.locator('.run-detail [role=alert]')).toContainText('Run cancelled.')
  await expect(page.getByRole('button', { name: 'Capture board & run' })).toBeEnabled()
})

test('mobile fits the viewport and model failures can be retried', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.unroute('**/api/models')
  let attempts = 0
  await page.route('**/api/models', route => {
    attempts++
    return attempts === 1 ? route.fulfill({ status: 400, json: { message: 'Unavailable' } }) : route.fulfill({ json: [{ name: 'test/model', displayName: 'Test model', vendor: 'openRouter' }] })
  })
  await page.goto('/admin/chat')
  await expect(page.getByRole('button', { name: 'Capture board & run' })).toBeEnabled()
  await page.getByLabel('Coaching response', { exact: true }).check()
  await expect(page.getByRole('button', { name: 'Capture board & run' })).toBeDisabled()
  await page.getByRole('button', { name: 'Retry models' }).click()
  await expect(page.getByRole('button', { name: 'Capture board & run' })).toBeEnabled()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../output/coach-playground-mobile.png', fullPage: true })
})
