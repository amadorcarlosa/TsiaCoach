import { describe, expect, it } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { registryKey } from '@effect/atom-vue'
import { createWorkflowContext, workflowContextKey, workflowFacade, workflowField, workflowToRefs } from './registry'

describe('Nuxt workflow registry', () => {
  it('isolates state and feature instances across concurrent SSR applications', () => {
    const first = createWorkflowContext()
    const second = createWorkflowContext()
    try {
      const a = workflowField(first, 'test.student', { attemptId: 'first', phase: 'beforeCheck' })
      const b = workflowField(second, 'test.student', { attemptId: 'second', phase: 'beforeCheck' })
      a.value.phase = 'afterCorrectCheck'
      expect(b.value).toEqual({ attemptId: 'second', phase: 'beforeCheck' })
      expect(JSON.stringify(second.snapshot())).not.toContain('first')
    } finally { first.dispose(); second.dispose() }
  })

  it('publishes nested DTO edits and hydrates them before the first read', () => {
    const server = createWorkflowContext()
    const state = workflowField(server, 'test.sessions', { first: { selectedAnswer: null as string | null } })
    state.value.first.selectedAnswer = 'answer-a'
    const snapshot = JSON.parse(JSON.stringify(server.snapshot()))
    const browser = createWorkflowContext({ snapshot })
    try {
      const restored = workflowField(browser, 'test.sessions', { first: { selectedAnswer: null as string | null } })
      expect(restored.value.first.selectedAnswer).toBe('answer-a')
      expect(JSON.stringify(snapshot)).not.toMatch(/registry|runtime|exporter|Promise|AbortSignal/)
    } finally { server.dispose(); browser.dispose() }
  })

  it('binds the official Vue Atom composable to the same registry as imperative callers', async () => {
    const context = createWorkflowContext()
    const state = workflowFacade({ count: workflowField(context, 'test.count', 3) })
    state.count = 8
    const app = createSSRApp({
      setup() {
        const { count } = workflowToRefs(state)
        return () => h('span', String(count.value))
      },
    })
    app.provide(registryKey, context.registry)
    app.provide(workflowContextKey, context)
    try { expect(await renderToString(app)).toBe('<span>8</span>') }
    finally { context.dispose() }
  })

  it('aborts app-owned resources exactly once on disposal', () => {
    const context = createWorkflowContext()
    let cleanups = 0
    context.cleanups.add(() => { cleanups++ })
    context.dispose()
    context.dispose()
    expect(context.signal.aborted).toBe(true)
    expect(cleanups).toBe(1)
  })

  it('renders the settled state after asynchronous SSR initialization', async () => {
    const context = createWorkflowContext()
    const state = workflowFacade({ count: workflowField(context, 'test.prefetch-count', 0) })
    const app = createSSRApp({
      async setup() {
        const { count } = workflowToRefs(state)
        await Promise.resolve()
        state.count = 1
        return () => h('span', String(count.value))
      },
    })
    app.provide(registryKey, context.registry)
    app.provide(workflowContextKey, context)
    try {
      expect(await renderToString(app)).toBe('<span>1</span>')
      expect(JSON.stringify(context.snapshot())).toContain('"value":1')
    } finally { context.dispose() }
  })
})
