import { test as base, expect, type Locator } from '@playwright/test'

type ScaffoldSessionPage = {
  /** Creates an attempt, optionally with incorrect checks first, and returns its id. */
  startAttempt: (options?: { practiceItemId?: string, incorrectChecks?: number }) => Promise<string>
  /** Opens the walkthrough and waits for real hydration, so clicks reach live handlers. */
  open: (attemptId: string) => Promise<void>
  reload: () => Promise<void>
  step: (stepId: string) => Locator
  expectStep: (stepId: string) => Promise<void>
  /** Every learner submission posted to the session, in order. */
  submissions: () => unknown[]
  safeError: () => Locator
  expectSafeError: (text: string | RegExp) => Promise<void>
}

type Fixtures = {
  scaffoldSession: ScaffoldSessionPage
}

const FORBIDDEN_SUBMISSION_WORDS = ['satisfied', 'expected', 'correct', 'successCheck']

export const test = base.extend<Fixtures>({
  scaffoldSession: async ({ page, request }, use) => {
    const submitted: unknown[] = []
    page.on('request', (sent) => {
      if (sent.method() === 'POST' && sent.url().includes('/scaffold-sessions/') && sent.url().endsWith('/checks')) {
        const body = sent.postDataJSON()
        for (const word of FORBIDDEN_SUBMISSION_WORDS) {
          expect(JSON.stringify(body), `submission carries "${word}"`).not.toContain(word)
        }
        submitted.push(body)
      }
    })

    const waitForHydration = async () => {
      await page.waitForFunction(() => {
        const app = (document.querySelector('#__nuxt') as Element & {
          __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } }
        } | null)?.__vue_app__
        const nuxt = app?.config?.globalProperties?.$nuxt
        return Boolean(nuxt) && nuxt?.isHydrating === false
      })
    }

    const scaffoldSession: ScaffoldSessionPage = {
      startAttempt: async ({ practiceItemId = 'practice-item-sample-1', incorrectChecks = 0 } = {}) => {
        return await base.step(`ScaffoldSession.startAttempt: ${practiceItemId}, ${incorrectChecks} incorrect`, async () => {
          const started = await request.post('/api/attempts', { data: { practiceItemId } })
          expect(started.ok()).toBeTruthy()
          const { attemptId } = await started.json() as { attemptId: string }
          for (let check = 0; check < incorrectChecks; check++) {
            const checked = await request.post(`/api/attempts/${attemptId}/checks`, { data: { selectedAnswerId: 'answer-b' } })
            expect(checked.ok()).toBeTruthy()
          }
          return attemptId
        })
      },

      open: async (attemptId) => {
        await base.step(`ScaffoldSession.open: ${attemptId}`, async () => {
          await page.goto(`/scaffolds/${attemptId}`)
          await waitForHydration()
        })
      },

      reload: async () => {
        await base.step('ScaffoldSession.reload', async () => {
          await page.reload()
          await waitForHydration()
        })
      },

      step: stepId => page.locator(`[data-step-id="${stepId}"]`),

      expectStep: async (stepId) => {
        await base.step(`ScaffoldSession.expectStep: ${stepId}`, async () => {
          await expect(scaffoldSession.step(stepId)).toBeVisible()
        })
      },

      submissions: () => submitted,

      safeError: () => page.getByTestId('scaffold-safe-error'),

      expectSafeError: async (text) => {
        await base.step('ScaffoldSession.expectSafeError', async () => {
          const alert = scaffoldSession.safeError()
          await expect(alert).toBeVisible()
          await expect(alert).toContainText(text)
        })
      },
    }

    await use(scaffoldSession)
  },
})
