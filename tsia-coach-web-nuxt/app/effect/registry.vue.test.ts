// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { registryKey } from '@effect/atom-vue'
import { createWorkflowContext, workflowContextKey, workflowFacade, workflowField, workflowToRefs } from './registry'

describe('Atom Vue workflow rendering', () => {
  it('hydrates before the first read, updates nested fields, and retains state across remounts', async () => {
    const server = createWorkflowContext()
    const source = workflowField(server, 'test.browser-session', { attemptId: 'attempt-1', checks: 0 })
    source.value.checks = 1
    const browser = createWorkflowContext({ snapshot: server.snapshot() })
    server.dispose()
    const workflow = workflowFacade({
      session: workflowField(browser, 'test.browser-session', { attemptId: '', checks: 0 }),
    })
    const render = () => {
      const container = document.createElement('div')
      const app = createApp({
        setup() {
          const { session } = workflowToRefs(workflow)
          return () => h('span', session.value.attemptId + ':' + session.value.checks)
        },
      })
      app.provide(registryKey, browser.registry)
      app.provide(workflowContextKey, browser)
      app.mount(container)
      return { app, container }
    }
    const first = render()
    try {
      expect(first.container.textContent).toBe('attempt-1:1')
      workflow.session.checks = 2
      await nextTick()
      expect(first.container.textContent).toBe('attempt-1:2')
      first.app.unmount()
      const second = render()
      expect(second.container.textContent).toBe('attempt-1:2')
      second.app.unmount()
    } finally { browser.dispose() }
  })
})
