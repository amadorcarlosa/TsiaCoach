import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import { BatchSpanProcessor, ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-base'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { privateSpanExporter } from '#shared/effect/telemetry-privacy'
import { telemetrySamplingRatio } from '#shared/effect/telemetry-config'
import { disposeBrowserRuntime } from '~/effect/runtime'

const key = Symbol.for('tsia-coach.browser.telemetry')
type BrowserTelemetry = { provider: WebTracerProvider, flush: () => void }
const browserState = globalThis as typeof globalThis & { [key]?: BrowserTelemetry }

export default defineNuxtPlugin({
  name: 'telemetry',
  enforce: 'pre',
  order: -20,
  setup() {
    if (!browserState[key]) {
      const config = useRuntimeConfig().public
      const provider = new WebTracerProvider({
        resource: resourceFromAttributes({ 'service.name': 'web-nuxt-browser' }),
        sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(telemetrySamplingRatio(config.telemetrySamplingRatio)) }),
        spanProcessors: config.telemetryEnabled ? [new BatchSpanProcessor(privateSpanExporter(new OTLPTraceExporter({
          // The collector address and its credentials never enter the browser.
          url: new URL('/api/telemetry/traces', window.location.origin).href,
          timeoutMillis: 5_000,
        })), { scheduledDelayMillis: 1_000 })] : [],
      })
      provider.register({ propagator: new W3CTraceContextPropagator() })
      const flush = () => { void provider.forceFlush().catch(() => {}) }
      browserState[key] = { provider, flush }
      window.addEventListener('pagehide', flush)
    }
    if (import.meta.hot) import.meta.hot.dispose(async () => {
      browserState[key]?.flush()
      await disposeBrowserRuntime()
      // The browser realm owns the single provider/listener across app reloads.
      // Disabling its global API here races the replacement Nuxt app's startup.
    })
  },
})
