import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkflowContext, type WorkflowContext } from '~/effect/registry'
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import type { ScaffoldSession } from '#shared/types/scaffolds'
import {
  ScaffoldSessionLoadStates,
  useScaffoldSessionStore,
} from './scaffold-session'

let context: WorkflowContext

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
    context = createWorkflowContext()
    vi.unstubAllGlobals()
  })

  afterEach(() => context.dispose())

  it('wrong responses preserve the server-issued step', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(activeSession('step-1'))
      .mockResolvedValueOnce(item)
      .mockResolvedValueOnce(activeSession('step-1', 0, false))
    vi.stubGlobal('$fetch', fetch)
    const store = useScaffoldSessionStore(context)

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
    const store = useScaffoldSessionStore(context)

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

    const store = useScaffoldSessionStore(context)
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
    const store = useScaffoldSessionStore(context)

    await store.load('attempt-1')

    expect(store.loadState).toBe(ScaffoldSessionLoadStates.Error)
    expect(store.loadError).toContain('not available yet')
    expect(store.loadError).not.toContain('misconception-code-internal')
  })

  it('ignores an older route load that completes after the new route', async () => {
    let finishOld!: (value: ScaffoldSession) => void
    const old = new Promise<ScaffoldSession>(resolve => { finishOld = resolve })
    const fetch = vi.fn(async (url: string) => {
      if (url.includes('/attempt-old/')) return old
      if (url.includes('/attempt-new/')) return { ...activeSession('new-step'), sessionId: 'new-session', attemptId: 'attempt-new' }
      if (url.startsWith('/api/practice-items/')) return item
      throw new Error('Unexpected request')
    })
    vi.stubGlobal('$fetch', fetch)
    const store = useScaffoldSessionStore(context)
    const first = store.load('attempt-old')
    await store.load('attempt-new')
    finishOld({ ...activeSession('old-step'), sessionId: 'old-session', attemptId: 'attempt-old' })
    await first
    expect(store.attemptId).toBe('attempt-new')
    expect(store.session?.sessionId).toBe('new-session')
    expect(store.loadState).toBe(ScaffoldSessionLoadStates.Loaded)
  })

  it('restores an SSR session without repeating its initialization POST', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValueOnce(activeSession('step-2', 1)).mockResolvedValueOnce(item))
    const server = useScaffoldSessionStore(context)
    await server.load('attempt-1')
    const browserContext = createWorkflowContext({ snapshot: JSON.parse(JSON.stringify(context.snapshot())) })
    const fetch = vi.fn().mockRejectedValue(new Error('A hydrated session must not be initialized twice'))
    vi.stubGlobal('$fetch', fetch)
    try {
      const browser = useScaffoldSessionStore(browserContext)
      await browser.load('attempt-1')
      expect(fetch).not.toHaveBeenCalled()
      expect(browser.session?.sessionId).toBe('session-1')
      expect(browser.completedPercent).toBe(33)
    } finally { browserContext.dispose() }
  })

  it('ignores a coach response after the checked step advances', async () => {
    let finishCoach!: (value: unknown) => void
    const pendingCoach = new Promise(resolve => { finishCoach = resolve })
    const fetch = vi.fn()
      .mockResolvedValueOnce(activeSession('step-1'))
      .mockResolvedValueOnce(item)
      .mockImplementationOnce(() => pendingCoach)
      .mockResolvedValueOnce(activeSession('step-2', 1, true))
    vi.stubGlobal('$fetch', fetch)
    const store = useScaffoldSessionStore(context)
    await store.load('attempt-1')
    const reply = store.askCoach('How do I begin?')
    await store.submit({ type: 'selectAnswerChoice', answerChoiceId: 'answer-d' })
    finishCoach({ move: { type: 'answerQuestion', message: 'Reply for the old step' } })
    await reply
    expect(store.coachReply).toBeNull()
    expect(store.session?.state.type === 'active' && store.session.state.currentStep.id).toBe('step-2')
  })
})
