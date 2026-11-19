export type TelemetrySignal = 'traces' | 'logs' | 'metrics'
export type TelemetryEnvironment = Record<string, string | undefined>

export function telemetrySamplingRatio(value: unknown): number {
  if (value === undefined || value === null || value === '') return 1
  const ratio = Number(value)
  return Number.isFinite(ratio) && ratio >= 0 && ratio <= 1 ? ratio : 1
}

export function otlpSettings(env: TelemetryEnvironment, signal: TelemetrySignal) {
  const prefix = `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}`
  const endpoint = env[`${prefix}_ENDPOINT`] ?? (env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? `${env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '')}/v1/${signal}` : undefined)
  const protocol = env[`${prefix}_PROTOCOL`] ?? env.OTEL_EXPORTER_OTLP_PROTOCOL ?? 'http/protobuf'
  const enabled = env[`OTEL_${signal.toUpperCase()}_EXPORTER`] !== 'none'
  if (!enabled || !endpoint || protocol !== 'http/protobuf') return undefined
  try {
    const url = new URL(endpoint)
    if (!['http:', 'https:'].includes(url.protocol)) return undefined
  } catch { return undefined }
  return {
    url: endpoint,
    headers: parseOtelPairs(env[`${prefix}_HEADERS`] ?? env.OTEL_EXPORTER_OTLP_HEADERS),
    timeoutMillis: 5_000,
  }
}

export function parseOtelPairs(value: string | undefined): Record<string, string> {
  const pairs: Record<string, string> = {}
  for (const part of value?.split(',') ?? []) {
    const index = part.indexOf('=')
    if (index < 1) continue
    try { pairs[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim()) } catch { /* Ignore malformed optional attributes. */ }
  }
  return pairs
}
