import { Effect, ManagedRuntime } from 'effect'
import { OtelTracer } from '@effect/opentelemetry'
import { unwrapExit } from '#shared/effect/run'

// This runtime holds only stateless tracing services. All learner state belongs to
// the per-Nuxt-app Atom registry, never this module.
let runtime: ReturnType<typeof makeRuntime> | undefined
const makeRuntime = () => ManagedRuntime.make(OtelTracer.layerGlobal)

export async function runBrowserEffect<A, E>(
  effect: Effect.Effect<A, E, never>,
  options: { signal?: AbortSignal, name?: string } = {},
): Promise<A> {
  const traced = options.name ? effect.pipe(Effect.withSpan(options.name)) : effect
  // Nitro owns the server provider. Resolve that provider for each SSR execution
  // so a renderer reload cannot retain a tracer whose owner has shut down.
  if (import.meta.server) {
    return unwrapExit(await Effect.runPromiseExit(traced.pipe(Effect.provide(OtelTracer.layerGlobal)), { signal: options.signal }))
  }
  runtime ??= makeRuntime()
  return unwrapExit(await runtime.runPromiseExit(traced, { signal: options.signal }))
}

export async function disposeBrowserRuntime() {
  const current = runtime
  runtime = undefined
  await current?.dispose()
}
