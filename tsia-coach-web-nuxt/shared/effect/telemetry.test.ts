import { describe, expect, it } from 'vitest'
import { otlpSettings, parseOtelPairs, telemetrySamplingRatio } from './telemetry-config'
import { telemetryProxyPolicy } from '#server/effect/telemetry-proxy'

describe('OTLP configuration and browser boundary', () => {
  const env = { OTEL_EXPORTER_OTLP_ENDPOINT: 'https://collector.example', OTEL_EXPORTER_OTLP_HEADERS: 'x-otlp-api-key=private%3Dkey' }
  const browserRequest = { origin: 'https://app.example', requestOrigin: 'https://app.example', contentType: 'application/x-protobuf', bytes: 128 }

  it('accepts bounded sampling configuration without breaking startup on invalid input', () => {
    expect(telemetrySamplingRatio('0.1')).toBe(0.1)
    expect(telemetrySamplingRatio('0')).toBe(0)
    expect(telemetrySamplingRatio(undefined)).toBe(1)
    expect(telemetrySamplingRatio('')).toBe(1)
    expect(telemetrySamplingRatio('invalid')).toBe(1)
    expect(telemetrySamplingRatio(2)).toBe(1)
  })

  it('uses signal-specific endpoints and headers without appending a second path', () => {
    expect(otlpSettings({ ...env, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: 'https://traces.example/exact', OTEL_EXPORTER_OTLP_TRACES_HEADERS: 'key=signal' }, 'traces')).toMatchObject({
      url: 'https://traces.example/exact', headers: { key: 'signal' },
    })
    expect(otlpSettings(env, 'logs')?.url).toBe('https://collector.example/v1/logs')
    expect(parseOtelPairs('key=a%3Db,invalid,other=x')).toEqual({ key: 'a=b', other: 'x' })
  })

  it('disables remote export without a destination or with an incompatible protocol', () => {
    expect(otlpSettings({}, 'traces')).toBeUndefined()
    expect(otlpSettings({ ...env, OTEL_EXPORTER_OTLP_PROTOCOL: 'grpc' }, 'traces')).toBeUndefined()
    expect(otlpSettings({ ...env, OTEL_TRACES_EXPORTER: 'none' }, 'traces')).toBeUndefined()
  })

  it('forwards only the fixed trace endpoint using server-side credentials', () => {
    expect(telemetryProxyPolicy(browserRequest, env)).toEqual({
      status: 200, upstream: { url: 'https://collector.example/v1/traces', headers: { 'x-otlp-api-key': 'private=key' }, timeoutMillis: 5_000 },
    })
    expect(telemetryProxyPolicy(browserRequest, {})).toEqual({ status: 204 })
  })

  it('rejects cross-origin, unsupported content and oversized batches', () => {
    expect(telemetryProxyPolicy({ ...browserRequest, origin: 'https://elsewhere.example' }, env)).toEqual({ status: 403 })
    expect(telemetryProxyPolicy({ ...browserRequest, origin: undefined }, env)).toEqual({ status: 403 })
    expect(telemetryProxyPolicy({ ...browserRequest, contentType: 'application/json' }, env)).toEqual({ status: 415 })
    expect(telemetryProxyPolicy({ ...browserRequest, bytes: 1024 * 1024 + 1 }, env)).toEqual({ status: 413 })
  })
})
