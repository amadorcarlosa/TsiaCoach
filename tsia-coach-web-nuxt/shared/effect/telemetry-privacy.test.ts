import { describe, expect, it } from 'vitest'
import { SpanStatusCode } from '@opentelemetry/api'
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { privateSpanExporter } from './telemetry-privacy'

describe('telemetry privacy at the exporter boundary', () => {
  it('keeps trace parentage and useful attributes while removing content from failures', async () => {
    const sink = new InMemorySpanExporter()
    const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(privateSpanExporter(sink))] })
    const span = provider.getTracer('test').startSpan('Coaching.request', {
      attributes: { 'http.request.method': 'POST', 'student.answer': 'private learner answer' },
    })
    span.recordException(new Error('private learner answer'))
    span.addEvent('private learner answer', { 'response.body': 'private learner answer' })
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'private learner answer' })
    span.end()
    await provider.forceFlush()
    const exported = sink.getFinishedSpans()
    expect(exported).toHaveLength(1)
    expect(exported[0]?.spanContext()).toEqual(span.spanContext())
    expect(exported[0]?.attributes).toEqual({ 'http.request.method': 'POST' })
    expect(exported[0]?.status.code).toBe(SpanStatusCode.ERROR)
    expect(JSON.stringify(exported)).not.toContain('private learner answer')
    await provider.shutdown()
  })
})
