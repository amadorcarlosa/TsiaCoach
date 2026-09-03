import { test as base, expect } from '@playwright/test'

type CoachPage = {
  /** Answers every coach turn with one authored reply, and records what the browser sent. */
  mockAnswer: (reply: { message: string, stepId: string }) => Promise<void>
  requests: () => Record<string, unknown>[]
  open: () => Promise<void>
  ask: (question: string) => Promise<void>
  expectReply: (text: string) => Promise<void>
}

type Fixtures = {
  coach: CoachPage
}

export const test = base.extend<Fixtures>({
  coach: async ({ page }, use) => {
    const captured: Record<string, unknown>[] = []

    const coach: CoachPage = {
      mockAnswer: async ({ message, stepId }) => {
        await page.route('**/api/attempts/*/coach', async (route) => {
          captured.push(route.request().postDataJSON() as Record<string, unknown>)
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ move: { type: 'answerQuestion', message, focusPhraseIds: [], stepId } }),
          })
        })
      },

      requests: () => captured,

      open: async () => {
        await base.step('Coach.open', async () => {
          await page.getByTestId('ask-coach').click()
          await expect(page.getByTestId('coach-panel')).toBeVisible()
        })
      },

      ask: async (question) => {
        await base.step(`Coach.ask: ${question}`, async () => {
          await page.getByLabel('Your question for the coach').fill(question)
          await page.getByTestId('coach-send').click()
        })
      },

      expectReply: async (text) => {
        await base.step('Coach.expectReply', async () => {
          await expect(page.getByTestId('coach-reply')).toContainText(text)
        })
      },
    }

    await use(coach)
  },
})
