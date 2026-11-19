// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest'
import { context, propagation, trace } from '@opentelemetry/api'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'

const key = Symbol.for('tsia-coach.browser.telemetry')
type Owner = { provider: WebTracerProvider, flush: () => void }

afterEach(async () => {
  const state = globalThis as typeof globalThis & { [key]?: Owner }
  const owner = state[key]
  if (owner) {
    window.removeEventListener('pagehide', owner.flush)
    await owner.provider.shutdown()
  }
  Reflect.deleteProperty(state, key)
  trace.disable()
  context.disable()
  propagation.disable()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('shares one browser provider and flush listener across repeated Nuxt app setup', async () => {
  vi.stubGlobal('defineNuxtPlugin', (definition: unknown) => definition)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { telemetryEnabled: false, telemetrySamplingRatio: 1 } }))
  const register = vi.spyOn(WebTracerProvider.prototype, 'register')
  const listen = vi.spyOn(window, 'addEventListener')
  const plugin = (await import('../plugins/telemetry.client')).default as unknown as { setup: () => void }
  plugin.setup()
  plugin.setup()
  expect(register).toHaveBeenCalledTimes(1)
  expect(listen.mock.calls.filter(([type]) => type === 'pagehide')).toHaveLength(1)
})
