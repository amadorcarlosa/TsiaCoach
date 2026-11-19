import { context, ROOT_CONTEXT, trace, defaultTextMapGetter, defaultTextMapSetter } from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

const propagator = new W3CTraceContextPropagator()

/** Only trace context crosses application boundaries; baggage may contain user data. */
export function traceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  propagator.inject(context.active(), headers, defaultTextMapSetter)
  return headers
}

export function incomingTraceContext(headers: Record<string, string | string[] | undefined>) {
  return trace.getSpanContext(propagator.extract(ROOT_CONTEXT, headers, defaultTextMapGetter))
}
