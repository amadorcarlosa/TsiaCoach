import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import type { ScaffoldSession } from '#shared/types/scaffolds'
import {
  ScaffoldSessionLoadStates,
  useScaffoldSessionStore,
} from './scaffold-session'

const item = {
  id: 'practice-item-1',
  text: { sourceText: '', tokens: [], sentences: [], terms: [], phrases: [] },
  semantics: { entities: [], edges: [] },
  mathematics: { objects: [], textBindings: [] },
  interaction: { answers: [], answerMathBindings: [] },
} as unknown as PracticeItemPrompt

function activeSession(stepId: string, completedStepCount = 0, satisfied: boolean | null = null) {
  return {
    sessionId: 'session-1',
    attemptId: 'attempt-1',
    practiceItemId: item.id,
    scaffoldId: 'scaffold-1',
    entryStepId: 'step-1',
    checkCount: satisfied === null ? 0 : 1,
    completedStepCount,
    totalStepCount: 3,
    resources: [],
    state: {
      type: 'active',
      evidence: null,
      currentStep: {
        id: stepId,
        prompt: { text: 'Prompt', focusPhraseIds: [] },
        scene: { type: 'answerChoiceScene' },
        action: { type: 'selectAnswerChoice' },
      },
    },
    lastCheck: satisfied === null ? null : { stepId: 'step-1', satisfied },
  } as ScaffoldSession
}

describe('scaffold session store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('wrong responses preserve the server-issued step', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(activeSession('step-1'))
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(activeSession('step-1', 0, false))
    vi.stubGlobal('$fetch', fetch)
    const store = useScaffoldSessionStore()

    await store.load('attempt-1')
    await store.submit({ type: 'selectAnswerChoice', answerChoiceId: 'answer-a' })

    expect(store.session?.state.type).toBe('active')
    expect(store.session?.state.type === 'active' && store.session.state.currentStep.id)
      .toBe('step-1')
    expect(store.session?.lastCheck).toEqual({ stepId: 'step-1', satisfied: false })
  })

  it('advances only from the returned server state', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(activeSession('step-1'))
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(activeSession('step-2', 1, true))
    vi.stubGlobal('$fetch', fetch)
    const store = useScaffoldSessionStore()

    await store.load('attempt-1')
    await store.submit({ type: 'selectAnswerChoice', answerChoiceId: 'answer-d' })

    expect(store.session?.state.type === 'active' && store.session.state.currentStep.id)
      .toBe('step-2')
    expect(store.session?.completedStepCount).toBe(1)
  })

  it('a fresh store resumes progress returned by start-session', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(activeSession('step-2', 1, true))
      .mockResolvedValueOnce(item)
    vi.stubGlobal('$fetch', fetch)

    const store = useScaffoldSessionStore()
    await store.load('attempt-1')

    expect(store.session?.state.type === 'active' && store.session.state.currentStep.id)
      .toBe('step-2')
    expect(store.completedPercent).toBe(33)
  })

  it('shows a safe message when the attempt is not authorized', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue({
      statusCode: 409,
      data: { detail: 'misconception-code-internal' },
    }))
    const store = useScaffoldSessionStore()

    await store.load('attempt-1')

    expect(store.loadState).toBe(ScaffoldSessionLoadStates.Error)
    expect(store.loadError).toContain('not available yet')
    expect(store.loadError).not.toContain('misconception-code-internal')
  })
})
