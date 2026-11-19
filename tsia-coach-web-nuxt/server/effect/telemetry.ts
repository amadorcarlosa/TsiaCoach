import { context, metrics, propagation, trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { LoggerProvider, BatchLogRecordProcessor, type LogRecordProcessor } from '@opentelemetry/sdk-logs'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { Context, Effect, Layer, ManagedRuntime } from 'effect'
import { OtelLogger, OtelTracer } from '@effect/opentelemetry'
import { otlpSettings, parseOtelPairs, type TelemetryEnvironment } from '#shared/effect/telemetry-config'
import { privateSpanExporter, safeAttributes } from '#shared/effect/telemetry-privacy'

export class TelemetryMetrics extends Context.Service<TelemetryMetrics, {
  readonly record: (operation: string, elapsedSeconds: number, failed: boolean) => Effect.Effect<void>
}>()('tsia/TelemetryMetrics') {}

function makeTelemetry(env: TelemetryEnvironment) {
  const resource = resourceFromAttributes({
    ...parseOtelPairs(env.OTEL_RESOURCE_ATTRIBUTES),
    'service.name': env.OTEL_SERVICE_NAME ?? 'web-nuxt',
  })
  const traces = otlpSettings(env, 'traces')
  const logConfig = otlpSettings(env, 'logs')
  const metricConfig = otlpSettings(env, 'metrics')
  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: traces ? [new BatchSpanProcessor(privateSpanExporter(new OTLPTraceExporter(traces)), {
      scheduledDelayMillis: Number(env.OTEL_BSP_SCHEDULE_DELAY) || 1_000,
      exportTimeoutMillis: 5_000,
    })] : [],
  })
  tracerProvider.register()
  const processors: LogRecordProcessor[] = []
  if (logConfig) {
    const batch = new BatchLogRecordProcessor({ exporter: new OTLPLogExporter(logConfig), scheduledDelayMillis: 1_000 })
    processors.push({
      onEmit(record) {
        // Logs intentionally carry event categories, never request/provider bodies.
        const attributes = safeAttributes(record.attributes as Parameters<typeof safeAttributes>[0])
        for (const key of Object.keys(record.attributes)) Reflect.deleteProperty(record.attributes, key)
        record.setAttributes(attributes)
        record.setBody('application.operation')
        record.setEventName('application.operation')
        batch.onEmit(record)
      },
      forceFlush: () => batch.forceFlush(),
      shutdown: () => batch.shutdown(),
    })
  }
  const loggerProvider = new LoggerProvider({ resource, processors })
  logs.setGlobalLoggerProvider(loggerProvider)
  const meterProvider = new MeterProvider({
    resource,
    readers: metricConfig ? [new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(metricConfig),
      exportIntervalMillis: Math.max(1_000, Number(env.OTEL_METRIC_EXPORT_INTERVAL) || 5_000),
      exportTimeoutMillis: 1_000,
    })] : [],
  })
  metrics.setGlobalMeterProvider(meterProvider)
  const meter = meterProvider.getMeter('tsia-coach.web')
  const requests = meter.createCounter('tsia.web.requests', { description: 'Completed Nuxt application requests' })
  const duration = meter.createHistogram('tsia.web.request.duration', { unit: 's' })
  const failures = meter.createCounter('tsia.web.failures')
  const record = (operation: string, elapsedSeconds: number, failed: boolean) => {
    const labels = { operation, outcome: failed ? 'failure' : 'success' }
    requests.add(1, labels)
    duration.record(elapsedSeconds, labels)
    if (failed) failures.add(1, { operation })
  }
  const metricService = {
    record: (operation: string, elapsedSeconds: number, failed: boolean) => Effect.sync(() => record(operation, elapsedSeconds, failed)),
  }
  const runtime = ManagedRuntime.make(Layer.mergeAll(
    OtelTracer.layerGlobal,
    OtelLogger.layer({ mergeWithExisting: true }).pipe(Layer.provide(Layer.succeed(OtelLogger.OtelLoggerProvider, loggerProvider))),
    Layer.succeed(TelemetryMetrics, metricService),
  ))
  let closed = false
  return {
    runtime, tracerProvider, loggerProvider, meterProvider, record,
    async flush() {
      await Promise.allSettled([tracerProvider.forceFlush(), loggerProvider.forceFlush(), meterProvider.forceFlush()])
    },
    async close() {
      if (closed) return
      closed = true
      await runtime.dispose()
      await Promise.allSettled([tracerProvider.shutdown(), loggerProvider.shutdown(), meterProvider.shutdown()])
      trace.disable(); logs.disable(); metrics.disable(); context.disable(); propagation.disable()
    },
  }
}

type ServerTelemetry = ReturnType<typeof makeTelemetry>
const key = Symbol.for('tsia-coach.server.telemetry')
const closingKey = Symbol.for('tsia-coach.server.telemetry.closing')
const processState = globalThis as typeof globalThis & { [key]?: ServerTelemetry, [closingKey]?: Promise<void> }

/** Singleton survives Nitro module reloads; scopes never contain learner/request state. */
export function serverTelemetry(env: TelemetryEnvironment = process.env): ServerTelemetry {
  return processState[key] ??= makeTelemetry(env)
}

export async function closeServerTelemetry() {
  if (processState[closingKey]) return processState[closingKey]
  const current = processState[key]
  if (!current) return
  const closing = current.close().finally(() => {
    if (processState[key] === current) Reflect.deleteProperty(processState, key)
    if (processState[closingKey] === closing) Reflect.deleteProperty(processState, closingKey)
  })
  processState[closingKey] = closing
  await closing
}

export async function initializeServerTelemetry() {
  await processState[closingKey]
  return serverTelemetry()
}

export const recordRequest = (operation: string, durationSeconds: number, failed: boolean) =>
  Effect.flatMap(TelemetryMetrics, service => service.record(operation, durationSeconds, failed))
