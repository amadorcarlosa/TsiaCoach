import type { Attributes } from '@opentelemetry/api'
import type { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base'

const allowedAttributes = new Set([
  'http.request.method', 'http.response.status_code', 'http.route',
  'operation', 'outcome', 'error.type', 'exception.type', 'effect.fiberId',
])

export function safeAttributes(attributes: Attributes): Attributes {
  return Object.fromEntries(Object.entries(attributes).filter(([key]) => allowedAttributes.has(key)))
}

/** Export metadata only: Effect failure messages can contain upstream response bodies. */
export function privateSpanExporter(exporter: SpanExporter): SpanExporter {
  return {
    export(spans, callback) {
      const sanitized: ReadableSpan[] = spans.map(span => ({
        name: span.name,
        kind: span.kind,
        spanContext: () => span.spanContext(),
        parentSpanContext: span.parentSpanContext,
        startTime: span.startTime,
        endTime: span.endTime,
        duration: span.duration,
        ended: span.ended,
        status: { code: span.status.code },
        attributes: safeAttributes(span.attributes),
        // Exception event names can themselves be arbitrary error messages.
        events: span.events.map(event => ({
          name: 'operation.event', time: event.time, attributes: safeAttributes(event.attributes ?? {}),
        })),
        links: span.links.map(link => ({ context: link.context, attributes: {} })),
        resource: span.resource,
        instrumentationScope: span.instrumentationScope,
        droppedAttributesCount: span.droppedAttributesCount,
        droppedEventsCount: span.droppedEventsCount,
        droppedLinksCount: span.droppedLinksCount,
      }))
      exporter.export(sanitized, callback)
    },
    shutdown: () => exporter.shutdown(),
    forceFlush: () => exporter.forceFlush?.() ?? Promise.resolve(),
  }
}
